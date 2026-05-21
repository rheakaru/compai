import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { loadCompanyForAccess } from '@/lib/model/access';
import {
  buildGraphNode,
  dedupeAgainstExisting,
  extractGraphNodes
} from '@/lib/agent/graph-extract';
import type {
  AxisPositionClaim,
  BrandingSnapshot,
  Claim,
  CompanyDoc,
  FactClaim,
  OneLinerClaim
} from '@/lib/model/claims';
import type { GraphNode } from '@/lib/model/graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface PersistedCompany extends Omit<CompanyDoc, 'branding'> {
  branding?: BrandingSnapshot | null;
}

/**
 * Auto-populate the POLE+O graph from a company's already-completed diagnosis.
 * Idempotent: if the graph already has any non-deleted nodes, do nothing
 * (returns existing). For new companies, /api/research calls the same
 * extraction code at the end of the stream; this endpoint backfills the
 * graph for companies analysed before the graph feature existed.
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
  const companyRef = db.collection('companies').doc(companyId);

  // Idempotency: bail if any non-deleted nodes exist already.
  const existingSnap = await companyRef.collection('graphNodes').get();
  const existing = existingSnap.docs
    .map(d => d.data() as GraphNode)
    .filter(n => !n.deletedAt);
  if (existing.length > 0) {
    return json({ ok: true, alreadyPopulated: true, nodes: existing });
  }

  // Load the diagnosis inputs.
  const [companySnap, claimsSnap] = await Promise.all([
    companyRef.get(),
    companyRef.collection('claims').get()
  ]);
  if (!companySnap.exists) return json({ error: 'company not found' }, 404);
  const company = companySnap.data() as PersistedCompany;

  const claims = claimsSnap.docs.map(d => d.data() as Claim);
  const live = claims.filter(c => c.supersededBy === null);
  const facts = live.filter((c): c is FactClaim => c.kind === 'fact');
  const axisClaims = live.filter(
    (c): c is AxisPositionClaim => c.kind === 'axis_position'
  );
  const oneLiner =
    live
      .filter((c): c is OneLinerClaim => c.kind === 'one_liner')
      .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;

  if (facts.length === 0 && axisClaims.length === 0) {
    return json({ error: 'no_diagnosis_yet', message: 'No claims to extract from.' }, 409);
  }

  let extracted;
  try {
    extracted = await extractGraphNodes({
      companyName: company.branding?.name ?? company.name ?? null,
      companyUrl: company.url,
      oneLiner,
      facts,
      axisClaims
    });
  } catch (err) {
    return json(
      { error: 'extraction_failed', message: err instanceof Error ? err.message : String(err) },
      500
    );
  }

  // Dedupe (defensive; existing should already be empty here).
  const fresh = dedupeAgainstExisting(extracted, existing);
  const nodes: GraphNode[] = fresh.map(e => buildGraphNode({ companyId, extracted: e }));

  if (nodes.length === 0) {
    return json({ ok: true, nodes: [] });
  }

  const batch = db.batch();
  for (const n of nodes) {
    batch.set(companyRef.collection('graphNodes').doc(n.id), n);
  }
  await batch.commit();

  return json({ ok: true, nodes });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
