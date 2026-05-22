import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { loadCompanyForAccess } from '@/lib/model/access';
import { generateSynthesis } from '@/lib/agent/synthesis';
import type {
  AxisPositionClaim,
  Claim,
  HardProblemClaim,
  OneLinerClaim,
  SynthesisClaim
} from '@/lib/model/claims';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Return the company's synthesis claim. If none exists yet (analyzed
 * before the synthesis feature shipped), generate one against the live
 * projection and persist it.
 *
 * Idempotent — re-calls return the existing synthesis. Does NOT consume
 * an edit from the 3-edit limit: synthesis is a read-augmentation that
 * costs Anthropic tokens but doesn't change the user's analysis.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ companyId: string }> }
) {
  const sessionId = await getOrCreateSessionId();
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) return json({ error: 'auth_required' }, 401);
  const { companyId } = await ctx.params;

  const access = await loadCompanyForAccess({
    companyId,
    uid: user.uid,
    sessionId
  });
  if (!access) return json({ error: 'company not found' }, 404);
  if (!access.canEdit) return json({ error: 'forbidden' }, 403);

  const db = adminDb();
  const claimsRef = db.collection('companies').doc(companyId).collection('claims');

  // Idempotency: return existing synthesis if any.
  const existingSnap = await claimsRef
    .where('kind', '==', 'synthesis')
    .where('supersededBy', '==', null)
    .get();
  const existing = existingSnap.docs
    .map(d => d.data() as SynthesisClaim)
    .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  if (existing) {
    return json({ ok: true, alreadyExisted: true, claim: existing });
  }

  // No synthesis yet — generate from the live projection.
  const allClaimsSnap = await claimsRef.get();
  const live = allClaimsSnap.docs
    .map(d => d.data() as Claim)
    .filter(c => c.supersededBy === null);
  const axisClaims = live.filter(
    (c): c is AxisPositionClaim => c.kind === 'axis_position'
  );
  if (axisClaims.length === 0) {
    return json({ error: 'no_axes_yet', message: 'Diagnosis not in yet.' }, 409);
  }
  const oneLiner =
    live
      .filter((c): c is OneLinerClaim => c.kind === 'one_liner')
      .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  const hotProblems = live
    .filter((c): c is HardProblemClaim => c.kind === 'hard_problem')
    .filter(h => !h.content.isDormant);

  let draft;
  try {
    draft = await generateSynthesis({ oneLiner, axisClaims, hotProblems });
  } catch (err) {
    return json(
      { error: 'generation_failed', message: err instanceof Error ? err.message : String(err) },
      500
    );
  }
  if (!draft.text) {
    return json({ error: 'empty_synthesis' }, 500);
  }

  const claim: SynthesisClaim = {
    id: randomUUID(),
    kind: 'synthesis',
    content: { text: draft.text, lowConfidence: draft.lowConfidence },
    provenance: 'agent_hypothesis',
    confidence: draft.lowConfidence ? 0.4 : 0.75,
    supersededBy: null,
    createdAt: Date.now()
  };
  await claimsRef.doc(claim.id).set(claim);

  return json({ ok: true, alreadyExisted: false, claim });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
