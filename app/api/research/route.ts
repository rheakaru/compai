import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { streamResearch } from '@/lib/agent/research';
import { createCompany, eventToClaim, persistClaim } from '@/lib/agent/persist';
import { loadOntology } from '@/lib/ontology/loader';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { computeHardProblemMap } from '@/lib/model/projection';
import { logFunnelEvent } from '@/lib/funnel/events';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import type { AxisPositionClaim, Claim } from '@/lib/model/claims';

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

      const axisClaims: AxisPositionClaim[] = [];

      try {
        for await (const event of streamResearch({ url, extraNotes: body?.notes })) {
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
        const derived = computeHardProblemMap(axisClaims, ontology);
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
