import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromRequest } from '@/lib/firebase/auth-server';
import type { FunnelEvent, FunnelStage } from '@/lib/funnel/events';
import type { CompanyDoc } from '@/lib/model/claims';
import type { RoleDoc } from '@/lib/model/role';

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
  const user = await getUserFromRequest(req);
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

  // -------------------------------------------------------------------
  // Per-company aggregation. Gives the operator a company-centric view
  // alongside the session-centric journeys.
  // -------------------------------------------------------------------
  const companiesSnap = await adminDb()
    .collection('companies')
    .orderBy('createdAt', 'desc')
    .limit(500)
    .get();

  const companies = await Promise.all(
    companiesSnap.docs.map(async doc => {
      const company = doc.data() as CompanyDoc & {
        branding?: { name?: string | null } | null;
        projects?: { generatedAt: number };
      };
      const companyId = doc.id;
      const rolesSnap = await adminDb()
        .collection('companies')
        .doc(companyId)
        .collection('roles')
        .get();
      const roles = rolesSnap.docs.map(r => r.data() as RoleDoc);

      // Funnel slice for THIS company.
      const companyEvents = events.filter(e => e.companyId === companyId);
      const profileViews = companyEvents.filter(e => e.stage === 'profile_viewed').length;
      const editsStarted = companyEvents.filter(e => e.stage === 'edit_started').length;
      const editsSaved = companyEvents.filter(e => e.stage === 'edit_saved').length;
      const exports = companyEvents.filter(e => e.stage === 'context_graph_exported').length;
      const signInEvents = companyEvents.filter(e => e.stage === 'signed_in');
      const signedInEmails = new Set<string>();
      for (const e of signInEvents) {
        if (typeof e.meta?.email === 'string') signedInEmails.add(e.meta.email as string);
      }

      let furthestStage: FunnelStage | null = null;
      let furthestRank = -1;
      let firstSeen = company.createdAt;
      let lastSeen = company.createdAt;
      for (const e of companyEvents) {
        const r = STAGE_ORDER.indexOf(e.stage);
        if (r > furthestRank) {
          furthestRank = r;
          furthestStage = e.stage;
        }
        firstSeen = Math.min(firstSeen, e.createdAt);
        lastSeen = Math.max(lastSeen, e.createdAt);
      }

      return {
        companyId,
        url: company.url,
        name: company.branding?.name ?? company.name ?? null,
        ownerUid: company.ownerUid,
        createdAt: company.createdAt,
        completedAt: company.completedAt ?? null,
        firstSeen,
        lastSeen,
        furthestStage,
        profileViews,
        editsStarted,
        editsSaved,
        exports,
        rolesInvited: roles.length,
        rolesCompleted: roles.filter(r => r.status === 'completed').length,
        signedInUsers: signedInEmails.size,
        projectsGenerated: !!company.projects?.generatedAt,
        userNotesLength: (company.userNotes ?? '').length
      };
    })
  );

  companies.sort((a, b) => b.lastSeen - a.lastSeen);

  return new Response(JSON.stringify({ journeys, companies }), {
    headers: { 'content-type': 'application/json' }
  });
}
