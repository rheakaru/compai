import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { loadCompanyForAccess } from '@/lib/model/access';
import { logFunnelEvent } from '@/lib/funnel/events';
import { regenerateOneLiner } from '@/lib/agent/oneliner';
import { computeHotDormant } from '@/lib/model/projection';
import { loadOntology } from '@/lib/ontology/loader';
import { consumeEdit, editLockedResponse } from '@/lib/limits/edits';
import type {
  AxisPositionClaim,
  Claim,
  Correction,
  HardProblemClaim,
  OneLinerClaim
} from '@/lib/model/claims';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  companyId: z.string().min(1),
  claimId: z.string().min(1),
  type: z.enum(['wrong_about_company', 'wrong_about_reading']),
  userNote: z.string().max(2000).optional().default(''),
  newAxisPosition: z
    .object({
      axisId: z.string(),
      position: z.string(),
      confidence: z.number().min(0).max(1)
    })
    .optional(),
  tombstone: z.boolean().optional().default(false)
});

export async function POST(req: NextRequest) {
  const sessionId = await getOrCreateSessionId();
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));

  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'bad request', details: parsed.error.flatten() }, 400);
  }
  const { companyId, claimId, type, userNote, newAxisPosition, tombstone } = parsed.data;

  const access = await loadCompanyForAccess({
    companyId,
    uid: user?.uid ?? null,
    sessionId
  });
  if (!access) return json({ error: 'company not found' }, 404);

  // Gate 1: anonymous users may TRY (we record edit_started)
  // but SAVE requires auth. The auth wall lands here, not earlier.
  if (!user) {
    await logFunnelEvent({
      sessionId,
      ownerUid: null,
      companyId,
      companyUrl: access.company.url,
      stage: 'edit_blocked_by_auth',
      meta: { claimId, type }
    });
    return json({ error: 'auth_required' }, 401);
  }
  if (!access.canEdit) {
    // owner mismatch: this user signed in but doesn't own this company
    return json({ error: 'forbidden' }, 403);
  }

  const edit = await consumeEdit(companyId);
  if (!edit.ok) return editLockedResponse(edit.state);

  const db = adminDb();
  const oldClaimRef = db.collection('companies').doc(companyId).collection('claims').doc(claimId);
  const oldClaimSnap = await oldClaimRef.get();
  if (!oldClaimSnap.exists) return json({ error: 'claim not found' }, 404);
  const oldClaim = oldClaimSnap.data() as Claim;
  if (oldClaim.supersededBy) {
    return json({ error: 'already superseded' }, 409);
  }

  const now = Date.now();
  let newClaim: Claim | null = null;

  if (tombstone) {
    // Deletion = a correction whose new claim is a tombstone marker.
    // We mark `_tombstoned: true` in content; the projection layer filters it.
    const tombstoned = {
      ...oldClaim,
      id: randomUUID(),
      provenance: 'user_provided',
      createdAt: now,
      supersededBy: null,
      content: {
        ...((oldClaim as { content: Record<string, unknown> }).content ?? {}),
        _tombstoned: true
      }
    } as unknown;
    newClaim = tombstoned as Claim;
  } else if (oldClaim.kind === 'axis_position' && newAxisPosition) {
    if (newAxisPosition.axisId !== oldClaim.content.axisId) {
      return json({ error: 'axisId mismatch' }, 400);
    }
    newClaim = {
      id: randomUUID(),
      kind: 'axis_position',
      content: {
        axisId: newAxisPosition.axisId,
        position: newAxisPosition.position,
        confidence: newAxisPosition.confidence,
        evidence: [
          {
            source: user.email ?? user.uid,
            quote: userNote || 'Corrected by owner.',
            provenance: 'user_provided'
          }
        ]
      },
      provenance: 'user_provided',
      confidence: newAxisPosition.confidence,
      supersededBy: null,
      createdAt: now
    };
  } else {
    return json({ error: 'unsupported correction shape for this claim kind' }, 400);
  }

  const correction: Correction = {
    id: randomUUID(),
    claimId: oldClaim.id,
    type,
    userNote,
    createdAt: now
  };

  // Atomic: write new claim, flip supersededBy, write correction.
  const batch = db.batch();
  batch.set(
    db.collection('companies').doc(companyId).collection('claims').doc(newClaim.id),
    newClaim
  );
  batch.update(oldClaimRef, { supersededBy: newClaim.id });
  batch.set(
    db.collection('companies').doc(companyId).collection('corrections').doc(correction.id),
    correction
  );
  await batch.commit();

  // Recompute derived state from the new live set.
  const { ontology } = loadOntology();
  const allClaimsSnap = await db.collection('companies').doc(companyId).collection('claims').get();
  const liveClaims = allClaimsSnap.docs
    .map(d => d.data() as Claim)
    .filter(c => c.supersededBy === null);

  // Drop previous derived hard_problem claims (they are server-generated, freely replaceable).
  const oldDerived = allClaimsSnap.docs
    .map(d => d.data() as Claim)
    .filter(c => c.kind === 'hard_problem' && c.supersededBy === null);
  const supersedeBatch = db.batch();
  for (const c of oldDerived) {
    supersedeBatch.update(
      db.collection('companies').doc(companyId).collection('claims').doc(c.id),
      { supersededBy: '__recomputed__' }
    );
  }

  const liveAxes = liveClaims.filter(
    (c): c is AxisPositionClaim => c.kind === 'axis_position'
  );
  // Note: agent-surfaced interactions are not re-derived on correction —
  // they would require re-running the agent. Declared interactions re-match
  // against the corrected vector deterministically inside computeHotDormant.
  const newDerived = computeHotDormant({ axisClaims: liveAxes, ontology });
  const newHardProblems: HardProblemClaim[] = [];
  for (const hp of newDerived) {
    const persistable = { ...hp, id: randomUUID() };
    supersedeBatch.set(
      db.collection('companies').doc(companyId).collection('claims').doc(persistable.id),
      persistable
    );
    newHardProblems.push(persistable);
  }

  // Regenerate one-liner.
  const liveHotProblems = newHardProblems.filter(h => !h.content.isDormant);
  let newOneLiner: OneLinerClaim | null = null;
  try {
    const regen = await regenerateOneLiner({
      axisClaims: liveAxes,
      hotProblems: liveHotProblems
    });
    newOneLiner = {
      id: randomUUID(),
      kind: 'one_liner',
      content: { sentence: regen.sentence, lowConfidence: regen.lowConfidence },
      provenance: 'agent_hypothesis',
      confidence: regen.lowConfidence ? 0.4 : 0.75,
      supersededBy: null,
      createdAt: Date.now()
    };
    // Supersede previous one_liner claims.
    const oldOneLiners = liveClaims.filter(c => c.kind === 'one_liner');
    for (const c of oldOneLiners) {
      supersedeBatch.update(
        db.collection('companies').doc(companyId).collection('claims').doc(c.id),
        { supersededBy: newOneLiner.id }
      );
    }
    supersedeBatch.set(
      db.collection('companies').doc(companyId).collection('claims').doc(newOneLiner.id),
      newOneLiner
    );
  } catch {
    // Non-fatal: leave the previous one-liner in place if regen fails.
  }

  await supersedeBatch.commit();

  await logFunnelEvent({
    sessionId,
    ownerUid: user.uid,
    companyId,
    companyUrl: access.company.url,
    stage: 'edit_saved',
    meta: { claimId, type, kind: oldClaim.kind }
  });

  return json({
    ok: true,
    diff: {
      removedClaimIds: [oldClaim.id, ...oldDerived.map(c => c.id)],
      addedClaim: newClaim,
      newHardProblems,
      newOneLiner
    }
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
