import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { loadCompanyForAccess } from '@/lib/model/access';
import { logFunnelEvent } from '@/lib/funnel/events';
import { loadOntology } from '@/lib/ontology/loader';
import { projectFromClaims } from '@/lib/model/projection';
import { serializeContextGraph } from '@/lib/export/context-graph';
import {
  exportGateOpen,
  resolveExportGateLevel,
  type CompanyExportState
} from '@/lib/export/gate';
import type { Claim, CompanyDoc } from '@/lib/model/claims';
import type { FiveProjects } from '@/lib/agent/projects';
import type { SessionPlanContent } from '@/lib/agent/session-plan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PersistedCompanyDoc extends Omit<CompanyDoc, 'sessionPlan'> {
  projects?: { generatedAt: number; payload: FiveProjects };
  sessionPlan?: { generatedAt: number; payload: SessionPlanContent; gateVariantId: string };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ companyId: string }> }
) {
  const sessionId = await getOrCreateSessionId();
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  const { companyId } = await ctx.params;

  const access = await loadCompanyForAccess({
    companyId,
    uid: user?.uid ?? null,
    sessionId
  });
  if (!access) return json({ error: 'company not found' }, 404);
  if (!access.canEdit) return json({ error: 'forbidden' }, 403);

  const url = new URL(req.url);
  const includePreamble = url.searchParams.get('preamble') !== '0';
  const format = url.searchParams.get('format') ?? 'markdown';
  if (format !== 'markdown') {
    return json(
      { error: 'unsupported_format', message: 'Markdown is the only format offered.' },
      400
    );
  }

  const db = adminDb();
  const companyRef = db.collection('companies').doc(companyId);
  const companySnap = await companyRef.get();
  const company = companySnap.data() as PersistedCompanyDoc;

  const claimsSnap = await companyRef.collection('claims').get();
  const claims = claimsSnap.docs.map(d => d.data() as Claim);

  const { ontology } = loadOntology();
  const projection = projectFromClaims(claims, ontology);

  // Gate check — operator-tunable level via ontology.context_graph_export.gate.
  const state: CompanyExportState = {
    hasAxes: projection.axes.length > 0,
    hasProjects: !!company.projects?.payload,
    hasSessionPlan: !!company.sessionPlan?.payload
  };
  const gateLevel = resolveExportGateLevel(ontology);
  if (!exportGateOpen(state, gateLevel)) {
    return json(
      { error: 'gate_not_open', gateLevel, state },
      403
    );
  }

  const markdown = serializeContextGraph({
    projection,
    ontology,
    companyName: company.name ?? null,
    companyUrl: company.url,
    includePreamble
  });

  await logFunnelEvent({
    sessionId,
    ownerUid: user?.uid ?? null,
    companyId,
    companyUrl: company.url,
    stage: 'context_graph_exported',
    meta: { preambleIncluded: includePreamble, gateLevel }
  });

  return new Response(markdown, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
