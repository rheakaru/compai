import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { streamRoleDerivation, type RoleEvent } from '@/lib/agent/role';
import type {
  CareerStrategyClaim,
  CareerStrategyContent,
  Classification,
  InviteIndexDoc,
  RoleActivityClaim,
  RoleActivityContent,
  RoleDoc,
  RoleEvidenceItem
} from '@/lib/model/role';
import type { CompanyDoc } from '@/lib/model/claims';
import type { Provenance } from '@/lib/ontology/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Body = z.object({
  token: z.string().min(1),
  description: z.string().min(20).max(8000),
  sourceOfTruthDoc: z.string().max(500).optional().nullable()
});

const KNOWN_PROVENANCE = new Set<Provenance>([
  'found_on_site',
  'inferred_public',
  'agent_hypothesis',
  'user_provided'
]);

function coerceProvenance(v: unknown): Provenance {
  if (typeof v === 'string' && KNOWN_PROVENANCE.has(v as Provenance)) return v as Provenance;
  return 'user_provided';
}

function coerceClassification(v: unknown): Classification | null {
  if (v === 'translation' || v === 'judgement') return v;
  return null;
}

export async function POST(req: NextRequest) {
  const sessionId = await getOrCreateSessionId();
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'bad request' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }
  const { token, description, sourceOfTruthDoc } = parsed.data;

  const db = adminDb();
  const idxSnap = await db.collection('inviteIndex').doc(token).get();
  if (!idxSnap.exists) {
    return new Response(JSON.stringify({ error: 'invite not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }
  const idx = idxSnap.data() as InviteIndexDoc;
  const roleRef = db
    .collection('companies')
    .doc(idx.companyId)
    .collection('roles')
    .doc(idx.roleId);
  const roleSnap = await roleRef.get();
  if (!roleSnap.exists) {
    return new Response(JSON.stringify({ error: 'role not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }
  const role = roleSnap.data() as RoleDoc;

  // Mark started and bind invitee identity (uid if signed in, else session cookie).
  // sourceOfTruthDoc is the highest-weighted input to role classification —
  // persisted on the role doc so it survives across page loads and is available
  // to the company-level aggregate.
  await roleRef.update({
    status: 'started',
    startedAt: Date.now(),
    inviteeUid: user?.uid ?? role.inviteeUid ?? null,
    inviteeSessionId: role.inviteeSessionId ?? sessionId,
    inviteeEmail: user?.email ?? role.inviteeEmail ?? null,
    sourceOfTruthDoc: sourceOfTruthDoc?.trim() || null
  });

  // Company context (lightweight): name + url for the agent prompt only.
  const companySnap = await db.collection('companies').doc(idx.companyId).get();
  const company = companySnap.exists ? (companySnap.data() as CompanyDoc) : null;
  const companyContext = company
    ? `${company.name ?? company.url} (${company.url})`
    : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let careerStrategy: CareerStrategyContent | null = null;

      try {
        for await (const event of streamRoleDerivation({
          roleTitle: role.roleTitle,
          description,
          sourceOfTruthDoc: sourceOfTruthDoc?.trim() || null,
          companyContext
        })) {
          if (event.type === 'activity') {
            const cls = coerceClassification(event.classification);
            if (!cls) continue;
            const evidence: RoleEvidenceItem[] = Array.isArray(event.evidence)
              ? event.evidence.map(e => ({
                  source: e?.source ?? 'role_description',
                  quote: e?.quote ?? '',
                  provenance: coerceProvenance(e?.provenance)
                }))
              : [];
            const content: RoleActivityContent = {
              activity: event.activity,
              classification: cls,
              evidence
            };
            const claim: RoleActivityClaim = {
              id: randomUUID(),
              kind: 'role_activity',
              content,
              provenance: 'user_provided',
              confidence: event.confidence ?? 0.7,
              supersededBy: null,
              createdAt: Date.now()
            };
            try {
              await roleRef.collection('claims').doc(claim.id).set(claim);
              send({ type: 'claim', claim });
            } catch (err) {
              send({
                type: 'error',
                message: `failed to persist activity: ${
                  err instanceof Error ? err.message : String(err)
                }`
              });
            }
          } else if (event.type === 'career_strategy') {
            careerStrategy = event.strategy;
            // If the agent forgot to echo the file, fold it in so the
            // strategy view always shows it when the invitee named one.
            if (sourceOfTruthDoc?.trim() && !careerStrategy.sourceOfTruthAnchor) {
              careerStrategy.sourceOfTruthAnchor = sourceOfTruthDoc.trim();
            }
            const claim: CareerStrategyClaim = {
              id: randomUUID(),
              kind: 'career_strategy',
              content: careerStrategy,
              provenance: 'agent_hypothesis',
              confidence: 0.75,
              supersededBy: null,
              createdAt: Date.now()
            };
            try {
              await roleRef.collection('claims').doc(claim.id).set(claim);
              send({ type: 'claim', claim });
            } catch (err) {
              send({
                type: 'error',
                message: `failed to persist strategy: ${
                  err instanceof Error ? err.message : String(err)
                }`
              });
            }
          } else if (event.type === 'error') {
            send(event);
          }
        }

        if (careerStrategy) {
          await roleRef.update({ status: 'completed', completedAt: Date.now() });
        }
        send({ type: 'done' });
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : String(err)
        });
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
