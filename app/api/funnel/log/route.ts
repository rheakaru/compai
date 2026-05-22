import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { logFunnelEvent, type FunnelStage } from '@/lib/funnel/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CLIENT_LOGGABLE: FunnelStage[] = [
  'profile_viewed',
  'edit_started',
  'projects_viewed',
  'session_plan_viewed',
  'connector_map_viewed',
  'connector_map_honest_stop'
];

const Body = z.object({
  stage: z.string(),
  companyId: z.string().optional().nullable(),
  companyUrl: z.string().optional().nullable(),
  meta: z.record(z.string(), z.unknown()).optional()
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response('bad request', { status: 400 });
  }
  const { stage, companyId, companyUrl, meta } = parsed.data;
  if (!CLIENT_LOGGABLE.includes(stage as FunnelStage)) {
    return new Response('stage not client-loggable', { status: 400 });
  }
  const sessionId = await getOrCreateSessionId();
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  await logFunnelEvent({
    sessionId,
    ownerUid: user?.uid ?? null,
    companyId: companyId ?? null,
    companyUrl: companyUrl ?? null,
    stage: stage as FunnelStage,
    meta: meta ?? {}
  });
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' }
  });
}
