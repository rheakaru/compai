import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { loadCompanyForAccess } from '@/lib/model/access';
import { logFunnelEvent } from '@/lib/funnel/events';
import { loadOntology } from '@/lib/ontology/loader';
import { matchAnalogy } from '@/lib/model/analogy';
import { generateFiveProjects, type FiveProjects } from '@/lib/agent/projects';
import { detectDeclaredInteractions } from '@/lib/model/interactions';
import { computeRoleAggregate } from '@/lib/role/aggregate';
import type {
  AxisPositionClaim,
  Claim,
  HardProblemClaim,
  OneLinerClaim
} from '@/lib/model/claims';
import type { CompanyStack, Suite } from '@/lib/model/stack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const StackBody = z.object({
  companyId: z.string().min(1),
  stack: z.object({
    erp: z.string().max(200).default(''),
    accounting: z.string().max(200).default(''),
    suite: z.enum(['google_workspace', 'microsoft_365', 'zoho', 'other', 'none']),
    suiteOther: z.string().max(200).default(''),
    notes: z.string().max(1000).default(''),
    extraDetail: z.string().max(2000).default('')
  })
});

export async function POST(req: NextRequest) {
  const sessionId = await getOrCreateSessionId();
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) {
    return json({ error: 'auth_required' }, 401);
  }

  const parsed = StackBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'bad request' }, 400);
  const { companyId, stack } = parsed.data;

  const access = await loadCompanyForAccess({
    companyId,
    uid: user.uid,
    sessionId
  });
  if (!access) return json({ error: 'company not found' }, 404);
  if (!access.canEdit) return json({ error: 'forbidden' }, 403);

  const db = adminDb();
  const fullStack: CompanyStack = {
    ...stack,
    suite: stack.suite as Suite,
    submittedAt: Date.now()
  };

  await db
    .collection('companies')
    .doc(companyId)
    .set({ stack: fullStack }, { merge: true });

  await logFunnelEvent({
    sessionId,
    ownerUid: user.uid,
    companyId,
    companyUrl: access.company.url,
    stage: 'stack_submitted',
    meta: { suite: stack.suite }
  });
  await logFunnelEvent({
    sessionId,
    ownerUid: user.uid,
    companyId,
    companyUrl: access.company.url,
    stage: 'projects_requested',
    meta: {}
  });

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

  const { ontology } = loadOntology();
  const analogy = matchAnalogy(axisClaims, ontology);

  // Source-of-truth documents are the highest-priority concrete artifacts for
  // the projects generator (per the primary_elicitation block in ontology.yaml).
  // The aggregate also gives us role-derived signals to feed back into projects.
  const roleAggregate = await computeRoleAggregate(companyId);
  const sourceOfTruthDocs = roleAggregate.sourceOfTruthDocs;

  // Declared interactions whose `predicts` clause should shape framing.
  const firedInteractions = detectDeclaredInteractions(axisClaims, ontology)
    .map(f => {
      const declared = ontology.interactions?.find(i => i.id === f.interactionId);
      return declared?.predicts
        ? { id: f.interactionId, hotProblem: f.hotProblem, predicts: declared.predicts }
        : null;
    })
    .filter((x): x is { id: string; hotProblem: string; predicts: string } => x !== null);

  // Log the floor decision as a funnel meta — this is the operator's worklist
  // for "which analogy_library entries to author next."
  await logFunnelEvent({
    sessionId,
    ownerUid: user.uid,
    companyId,
    companyUrl: access.company.url,
    stage: analogy?.aboveFloor ? 'analogy_floor_cleared' : 'analogy_honest_stop',
    meta: {
      score: analogy?.score ?? null,
      analogyId: analogy?.entry.id ?? null,
      floor: ontology.meta.analogy_floor
    }
  });

  let projects: FiveProjects | null = null;
  try {
    projects = await generateFiveProjects({
      oneLiner,
      axisClaims,
      hotProblems,
      stack: fullStack,
      analogy,
      sourceOfTruthDocs,
      firedInteractions
    });
  } catch (err) {
    return json(
      { error: 'generation_failed', message: err instanceof Error ? err.message : String(err) },
      500
    );
  }

  // Persist for revisits.
  await db
    .collection('companies')
    .doc(companyId)
    .set(
      {
        projects: {
          generatedAt: Date.now(),
          analogyFloorCleared: analogy?.aboveFloor ?? false,
          analogyId: analogy?.entry.id ?? null,
          analogyScore: analogy?.score ?? null,
          payload: projects
        }
      },
      { merge: true }
    );

  return json({
    projects,
    analogy: analogy?.aboveFloor
      ? {
          entry: analogy.entry,
          score: analogy.score,
          aboveFloor: true
        }
      : { aboveFloor: false, score: analogy?.score ?? null }
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
