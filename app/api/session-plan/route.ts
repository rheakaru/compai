import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { loadCompanyForAccess } from '@/lib/model/access';
import { logFunnelEvent } from '@/lib/funnel/events';
import { loadOntology } from '@/lib/ontology/loader';
import { detectDeclaredInteractions } from '@/lib/model/interactions';
import { computeRoleAggregate } from '@/lib/role/aggregate';
import { generateSessionPlan, type SessionPlanContent } from '@/lib/agent/session-plan';
import { resolveGate, validateGateSubmission } from '@/lib/gate/commitment';
import type {
  AxisPositionClaim,
  Claim,
  CompanyDoc,
  HardProblemClaim,
  OneLinerClaim
} from '@/lib/model/claims';
import type { FiveProjects } from '@/lib/agent/projects';
import type { CompanyStack } from '@/lib/model/stack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const Body = z.object({
  companyId: z.string().min(1),
  commitment: z.record(z.string(), z.string()),
  variantId: z.string().min(1)
});

interface PersistedCompanyDoc extends CompanyDoc {
  projects?: { generatedAt: number; payload: FiveProjects };
  stack?: CompanyStack;
  sessionPlan?: { generatedAt: number; payload: SessionPlanContent; gateVariantId: string };
}

export async function POST(req: NextRequest) {
  const sessionId = await getOrCreateSessionId();
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) return json({ error: 'auth_required' }, 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'bad request' }, 400);
  const { companyId, commitment, variantId } = parsed.data;

  const access = await loadCompanyForAccess({
    companyId,
    uid: user.uid,
    sessionId
  });
  if (!access) return json({ error: 'company not found' }, 404);
  if (!access.canEdit) return json({ error: 'forbidden' }, 403);

  const { ontology } = loadOntology();
  const gate = resolveGate(ontology);
  const valid = validateGateSubmission(commitment, gate.commitment);
  if (!valid.ok) return json({ error: 'gate_invalid', reason: valid.reason }, 400);

  await logFunnelEvent({
    sessionId,
    ownerUid: user.uid,
    companyId,
    companyUrl: access.company.url,
    stage: 'session_plan_gate_passed',
    meta: { variantId, paymentToggleOn: gate.payment.enabled }
  });

  // Load the inputs the projector needs. Projects is required — this is the
  // 4th chain node, never standalone.
  const db = adminDb();
  const companySnap = await db.collection('companies').doc(companyId).get();
  const company = companySnap.data() as PersistedCompanyDoc;
  if (!company.projects?.payload) {
    return json({ error: 'projects_required' }, 409);
  }

  const claimsSnap = await db.collection('companies').doc(companyId).collection('claims').get();
  const allClaims = claimsSnap.docs.map(d => d.data() as Claim);
  const live = allClaims.filter(c => c.supersededBy === null);
  const axisClaims = live.filter((c): c is AxisPositionClaim => c.kind === 'axis_position');
  const hotProblems = live
    .filter((c): c is HardProblemClaim => c.kind === 'hard_problem')
    .filter(h => !h.content.isDormant)
    .sort((a, b) => b.content.weight - a.content.weight);
  const oneLiner =
    live
      .filter((c): c is OneLinerClaim => c.kind === 'one_liner')
      .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;

  const firedInteractions = detectDeclaredInteractions(axisClaims, ontology).map(f => {
    const declared = ontology.interactions?.find(i => i.id === f.interactionId);
    return {
      id: f.interactionId,
      hotProblem: f.hotProblem,
      predicts: declared?.predicts
    };
  });

  const roleAggregate = await computeRoleAggregate(companyId);

  let plan: SessionPlanContent;
  try {
    plan = await generateSessionPlan({
      oneLiner,
      axisClaims,
      hotProblems,
      projects: company.projects.payload,
      stack: company.stack ?? null,
      sourceOfTruthDocs: roleAggregate.sourceOfTruthDocs,
      firedInteractions
    });
  } catch (err) {
    return json(
      { error: 'generation_failed', message: err instanceof Error ? err.message : String(err) },
      500
    );
  }

  await db
    .collection('companies')
    .doc(companyId)
    .set(
      {
        sessionPlan: {
          generatedAt: Date.now(),
          payload: plan,
          gateVariantId: variantId,
          gateCommitment: commitment
        }
      },
      { merge: true }
    );

  return json({ plan, payment: gate.payment });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
