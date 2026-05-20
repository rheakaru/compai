import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { streamResearch } from '@/lib/agent/research';
import { createCompany, eventToClaim, persistClaim } from '@/lib/agent/persist';
import { loadOntology } from '@/lib/ontology/loader';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { computeHotDormant } from '@/lib/model/projection';
import { agentInteractionToFiring, type InteractionFiring } from '@/lib/model/interactions';
import { logFunnelEvent } from '@/lib/funnel/events';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { extractBranding } from '@/lib/branding/extract';
import { adminDb } from '@/lib/firebase/admin';
import { coerceRole, isGraphNodeType, type GraphNode } from '@/lib/model/graph';
import type { AxisPositionClaim, Claim, BrandingSnapshot, CompanyDoc } from '@/lib/model/claims';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function urlIsValid(raw: string): boolean {
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return !!u.hostname && u.hostname.includes('.');
  } catch {
    return false;
  }
}

function normalizeUrl(raw: string): string {
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

/**
 * Find an existing COMPLETED company for this URL that belongs to the same
 * user (or anonymous session). Per-user/session dedup — we don't reuse other
 * users' analyses because their corrections diverge.
 *
 * Skipped when notes are present; notes are real input, not a key to dedup on.
 */
async function findExistingCompletedCompany(opts: {
  url: string;
  ownerUid: string | null;
  sessionId: string;
}): Promise<string | null> {
  const snap = await adminDb()
    .collection('companies')
    .where('url', '==', opts.url)
    .limit(20)
    .get();

  const candidates = snap.docs
    .map(d => ({ id: d.id, data: d.data() as CompanyDoc }))
    .filter(({ data }) => {
      if (!data.completedAt) return false;
      if (opts.ownerUid) return data.ownerUid === opts.ownerUid;
      // Anonymous: dedup only against other anonymous docs from THIS session.
      return !data.ownerUid && data.sessionId === opts.sessionId;
    })
    .sort((a, b) => (b.data.createdAt ?? 0) - (a.data.createdAt ?? 0));

  return candidates[0]?.id ?? null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { url?: string; notes?: string } | null;
  const rawUrl = body?.url?.trim();
  if (!rawUrl || !urlIsValid(rawUrl)) {
    return new Response(JSON.stringify({ error: 'Provide a valid company URL.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }
  const url = normalizeUrl(rawUrl);

  const sessionId = await getOrCreateSessionId();
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  const { hash } = loadOntology();

  // Cache hit: same user/session already has a completed analysis for this URL.
  // Skip dedup when notes are present — notes are real input and may produce a
  // different read of the same company.
  const notes = body?.notes?.trim();
  if (!notes) {
    const existingId = await findExistingCompletedCompany({
      url,
      ownerUid: user?.uid ?? null,
      sessionId
    });
    if (existingId) {
      void logFunnelEvent({
        sessionId,
        ownerUid: user?.uid ?? null,
        companyId: existingId,
        companyUrl: url,
        stage: 'url_submitted',
        meta: { cacheHit: true }
      });
      return new Response(
        JSON.stringify({ companyId: existingId, alreadyCompleted: true }),
        { headers: { 'content-type': 'application/json' } }
      );
    }
  }

  const companyId = await createCompany({
    url,
    sessionId,
    ownerUid: user?.uid ?? null,
    ontologyVersionHash: hash
  });

  void logFunnelEvent({
    sessionId,
    ownerUid: user?.uid ?? null,
    companyId,
    companyUrl: url,
    stage: 'url_submitted'
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: 'company_created', companyId, ontologyVersionHash: hash });

      // Branding extraction runs in parallel with research — non-blocking on errors.
      void extractBranding(url)
        .then(async branding => {
          const snapshot: BrandingSnapshot = {
            logoUrl: branding.logoUrl,
            accentColor: branding.accentColor,
            name: branding.name,
            description: branding.description,
            extractedAt: branding.extractedAt
          };
          send({ type: 'branding', branding: snapshot });
          try {
            await adminDb()
              .collection('companies')
              .doc(companyId)
              .set({ branding: snapshot, name: snapshot.name ?? null }, { merge: true });
          } catch {
            // non-fatal: in-memory snapshot still rendered to the user
          }
        })
        .catch(() => undefined);

      const axisClaims: AxisPositionClaim[] = [];
      const agentInteractions: InteractionFiring[] = [];

      try {
        for await (const event of streamResearch({ url, extraNotes: body?.notes })) {
          if (event.type === 'graph_node') {
            // POLE+O graph node — written to a separate subcollection.
            // Not a claim; not part of the consequence computation.
            const nodeType = isGraphNodeType(event.nodeType) ? event.nodeType : null;
            const name = typeof event.name === 'string' ? event.name.trim().slice(0, 200) : '';
            if (!nodeType || !name) {
              continue;
            }
            const provRaw = typeof event.provenance === 'string' ? event.provenance : 'agent_hypothesis';
            const provenance =
              provRaw === 'found_on_site' || provRaw === 'inferred_public' || provRaw === 'agent_hypothesis'
                ? provRaw
                : 'agent_hypothesis';
            const node: GraphNode = {
              id: randomUUID(),
              companyId,
              type: nodeType,
              role: coerceRole(nodeType, event.role),
              name,
              notes:
                typeof event.notes === 'string' && event.notes.trim()
                  ? event.notes.trim().slice(0, 400)
                  : undefined,
              source: 'agent',
              provenance,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              deletedAt: null
            };
            try {
              await adminDb()
                .collection('companies')
                .doc(companyId)
                .collection('graphNodes')
                .doc(node.id)
                .set(node);
              send({ type: 'graph_node', node });
            } catch (err) {
              send({
                type: 'error',
                message: `Failed to persist graph node: ${err instanceof Error ? err.message : String(err)}`
              });
            }
            continue;
          }
          if (event.type === 'interaction') {
            // Agent-surfaced compounding pair. Always agent_hypothesis.
            const axes = Array.isArray(event.axes) ? (event.axes as string[]) : [];
            const hotProblem =
              typeof event.hotProblem === 'string' ? event.hotProblem : '';
            const mechanism =
              typeof event.mechanism === 'string' ? event.mechanism : '';
            const strength = typeof event.strength === 'number' ? event.strength : 0.5;
            if (axes.length >= 2 && hotProblem) {
              agentInteractions.push(
                agentInteractionToFiring(axes, hotProblem, mechanism, strength)
              );
              send({ type: 'agent_interaction', axes, hotProblem, mechanism, strength });
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
                message: `Failed to persist claim: ${err instanceof Error ? err.message : String(err)}`
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
          } catch (err) {
            send({
              type: 'error',
              message: `Failed to persist derived problem: ${err instanceof Error ? err.message : String(err)}`
            });
            continue;
          }
          send({ type: 'claim', claim: persistable });
        }

        // Mark the company complete so future pastes of this URL skip the agent.
        try {
          await adminDb()
            .collection('companies')
            .doc(companyId)
            .set({ completedAt: Date.now() }, { merge: true });
        } catch {
          // non-fatal — at worst we re-run the agent next time
        }
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
