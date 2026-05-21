import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { loadCompanyForAccess } from '@/lib/model/access';
import { streamResearch } from '@/lib/agent/research';
import { eventToClaim, persistClaim } from '@/lib/agent/persist';
import { loadOntology } from '@/lib/ontology/loader';
import { computeHotDormant } from '@/lib/model/projection';
import { agentInteractionToFiring, type InteractionFiring } from '@/lib/model/interactions';
import { generateSynthesis } from '@/lib/agent/synthesis';
import { logFunnelEvent } from '@/lib/funnel/events';
import { consumeEdit, editLockedResponse } from '@/lib/limits/edits';
import type {
  AxisPositionClaim,
  Claim,
  CompanyDoc,
  HardProblemClaim,
  OneLinerClaim,
  SynthesisClaim
} from '@/lib/model/claims';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Re-run the research agent against the same companyId with the owner's
 * userNotes as additional context. Supersedes all currently live claims
 * (axis_position, fact, hard_problem, one_liner, synthesis) so the new
 * projection takes over; the history is preserved via the append-only
 * supersededBy field, not deleted.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ companyId: string }> }
) {
  const sessionId = await getOrCreateSessionId();
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) return new Response('auth_required', { status: 401 });
  const { companyId } = await ctx.params;

  const access = await loadCompanyForAccess({
    companyId,
    uid: user.uid,
    sessionId
  });
  if (!access) return new Response('company not found', { status: 404 });
  if (!access.canEdit) return new Response('forbidden', { status: 403 });

  const edit = await consumeEdit(companyId);
  if (!edit.ok) return editLockedResponse(edit.state);

  const db = adminDb();
  const companyRef = db.collection('companies').doc(companyId);
  const companySnap = await companyRef.get();
  if (!companySnap.exists) return new Response('company not found', { status: 404 });
  const company = companySnap.data() as CompanyDoc;

  // Supersede the existing diagnosis. This is reversible via the append-only
  // model — the old claims stay in the collection with supersededBy set.
  const claimsSnap = await companyRef.collection('claims').get();
  const supersedeBatch = db.batch();
  let supersededCount = 0;
  for (const doc of claimsSnap.docs) {
    const data = doc.data() as Claim;
    if (data.supersededBy !== null) continue;
    if (
      data.kind === 'fact' ||
      data.kind === 'axis_position' ||
      data.kind === 'hard_problem' ||
      data.kind === 'one_liner' ||
      data.kind === 'synthesis'
    ) {
      supersedeBatch.update(doc.ref, { supersededBy: '__reanalyzed__' });
      supersededCount++;
    }
  }
  if (supersededCount > 0) await supersedeBatch.commit();

  void logFunnelEvent({
    sessionId,
    ownerUid: user.uid,
    companyId,
    companyUrl: company.url,
    stage: 'url_submitted',
    meta: { reanalyze: true, supersededCount }
  });

  // Stream the new research using the saved userNotes as extra context.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: 'reanalyze_started', companyId, supersededCount });

      const axisClaims: AxisPositionClaim[] = [];
      const agentInteractions: InteractionFiring[] = [];

      try {
        for await (const event of streamResearch({
          url: company.url,
          extraNotes: company.userNotes ?? undefined
        })) {
          if (event.type === 'interaction') {
            const axes = Array.isArray(event.axes) ? (event.axes as string[]) : [];
            const hotProblem = typeof event.hotProblem === 'string' ? event.hotProblem : '';
            const mechanism = typeof event.mechanism === 'string' ? event.mechanism : '';
            const strength = typeof event.strength === 'number' ? event.strength : 0.5;
            if (axes.length >= 2 && hotProblem) {
              agentInteractions.push(
                agentInteractionToFiring(axes, hotProblem, mechanism, strength)
              );
            }
            continue;
          }
          const claim = eventToClaim(event);
          if (claim) {
            try {
              await persistClaim(companyId, claim);
            } catch (err) {
              send({
                type: 'error',
                message: err instanceof Error ? err.message : String(err)
              });
            }
            if (claim.kind === 'axis_position') axisClaims.push(claim);
            send({ type: 'claim', claim });
          } else {
            send(event);
          }
        }

        const { ontology } = loadOntology();
        const derived = computeHotDormant({ axisClaims, ontology, agentInteractions });
        for (const hp of derived) {
          const persistable: Claim = { ...hp, id: randomUUID() };
          try {
            await persistClaim(companyId, persistable);
          } catch {
            // skip — already sent error events
          }
          send({ type: 'claim', claim: persistable });
        }

        // Re-generate synthesis against the new vector.
        try {
          const liveOneLinerSnap = await companyRef
            .collection('claims')
            .where('kind', '==', 'one_liner')
            .where('supersededBy', '==', null)
            .get();
          const liveOneLiner =
            liveOneLinerSnap.docs
              .map(d => d.data() as OneLinerClaim)
              .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
          const liveHotProblems = derived.filter(
            (h): h is HardProblemClaim => h.kind === 'hard_problem' && !h.content.isDormant
          );
          const synthesis = await generateSynthesis({
            oneLiner: liveOneLiner,
            axisClaims,
            hotProblems: liveHotProblems
          });
          if (synthesis.text) {
            const claim: SynthesisClaim = {
              id: randomUUID(),
              kind: 'synthesis',
              content: { text: synthesis.text, lowConfidence: synthesis.lowConfidence },
              provenance: 'agent_hypothesis',
              confidence: synthesis.lowConfidence ? 0.4 : 0.75,
              supersededBy: null,
              createdAt: Date.now()
            };
            await persistClaim(companyId, claim);
            send({ type: 'claim', claim });
          }
        } catch {
          // non-fatal
        }

        await companyRef.set({ completedAt: Date.now() }, { merge: true });
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      } finally {
        send({ type: 'stream_end' });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no'
    }
  });
}
