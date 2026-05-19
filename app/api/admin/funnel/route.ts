import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import type { FunnelEvent, FunnelStage } from '@/lib/funnel/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAGE_ORDER: FunnelStage[] = [
  'url_submitted',
  'profile_viewed',
  'edit_started',
  'edit_blocked_by_auth',
  'signed_in',
  'edit_saved',
  'analogy_floor_cleared',
  'analogy_honest_stop',
  'projects_requested',
  'stack_submitted',
  'projects_viewed'
];

export async function GET(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) return new Response('unauthorized', { status: 401 });
  if (!user.operator) return new Response('forbidden — operator only', { status: 403 });

  const snap = await adminDb()
    .collection('funnelEvents')
    .orderBy('createdAt', 'desc')
    .limit(2000)
    .get();
  const events = snap.docs.map(d => d.data() as FunnelEvent);

  // Group by sessionId; pull furthest stage, company url, stack if present.
  const journeysBySession = new Map<
    string,
    {
      sessionId: string;
      ownerUid: string | null;
      email: string | null;
      companyIds: Set<string>;
      companyUrls: Set<string>;
      furthestStage: FunnelStage;
      furthestStageRank: number;
      firstSeen: number;
      lastSeen: number;
      stackSummary: string | null;
      analogyFloorCleared: boolean | null;
    }
  >();

  for (const e of events) {
    const cur = journeysBySession.get(e.sessionId);
    const rank = STAGE_ORDER.indexOf(e.stage);
    const next = cur ?? {
      sessionId: e.sessionId,
      ownerUid: null,
      email: null,
      companyIds: new Set<string>(),
      companyUrls: new Set<string>(),
      furthestStage: e.stage,
      furthestStageRank: rank,
      firstSeen: e.createdAt,
      lastSeen: e.createdAt,
      stackSummary: null,
      analogyFloorCleared: null
    };
    if (e.ownerUid) next.ownerUid = e.ownerUid;
    if (e.companyId) next.companyIds.add(e.companyId);
    if (e.companyUrl) next.companyUrls.add(e.companyUrl);
    if (rank > next.furthestStageRank) {
      next.furthestStage = e.stage;
      next.furthestStageRank = rank;
    }
    next.firstSeen = Math.min(next.firstSeen, e.createdAt);
    next.lastSeen = Math.max(next.lastSeen, e.createdAt);
    if (e.stage === 'stack_submitted' && typeof e.meta?.suite === 'string') {
      next.stackSummary = e.meta.suite as string;
    }
    if (e.stage === 'signed_in' && typeof e.meta?.email === 'string') {
      next.email = e.meta.email as string;
    }
    if (e.stage === 'analogy_floor_cleared') next.analogyFloorCleared = true;
    if (e.stage === 'analogy_honest_stop' && next.analogyFloorCleared === null) {
      next.analogyFloorCleared = false;
    }
    journeysBySession.set(e.sessionId, next);
  }

  const journeys = [...journeysBySession.values()]
    .map(j => ({
      ...j,
      companyIds: [...j.companyIds],
      companyUrls: [...j.companyUrls]
    }))
    .sort((a, b) => b.lastSeen - a.lastSeen);

  return new Response(JSON.stringify({ journeys }), {
    headers: { 'content-type': 'application/json' }
  });
}
