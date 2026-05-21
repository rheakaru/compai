import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase/admin';
import { loadOntology } from '@/lib/ontology/loader';
import { Profile } from '@/components/Profile';
import { resolveGate } from '@/lib/gate/commitment';
import type { BrandingSnapshot, Claim, CompanyDoc } from '@/lib/model/claims';
import type { FiveProjects } from '@/lib/agent/projects';
import type { SessionPlanContent } from '@/lib/agent/session-plan';
import type { GraphEdge, GraphNode } from '@/lib/model/graph';

export const dynamic = 'force-dynamic';

interface PersistedCompanyDoc extends CompanyDoc {
  branding?: BrandingSnapshot | null;
  projects?: {
    generatedAt: number;
    payload: FiveProjects;
  };
  sessionPlan?: {
    generatedAt: number;
    payload: SessionPlanContent;
    gateVariantId: string;
  };
}

export default async function CompanyPage({
  params
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const { ontology } = loadOntology();
  const sessionGate = resolveGate(ontology);

  const companyRef = adminDb().collection('companies').doc(companyId);
  const companySnap = await companyRef.get();
  if (!companySnap.exists) {
    notFound();
  }
  const company = companySnap.data() as PersistedCompanyDoc;

  const [claimsSnap, graphSnap, edgesSnap] = await Promise.all([
    companyRef.collection('claims').get(),
    companyRef.collection('graphNodes').get(),
    companyRef.collection('graphEdges').get()
  ]);
  const claims = claimsSnap.docs.map(d => d.data() as Claim);
  const graphNodes = graphSnap.docs
    .map(d => d.data() as GraphNode)
    .filter(n => !n.deletedAt)
    .sort((a, b) => a.createdAt - b.createdAt);
  const graphEdges = edgesSnap.docs
    .map(d => d.data() as GraphEdge)
    .filter(e => !e.deletedAt)
    .sort((a, b) => a.createdAt - b.createdAt);

  return (
    <Profile
      initialClaims={claims}
      ontology={ontology}
      companyId={companyId}
      companyUrl={company.url}
      initialProjects={company.projects?.payload ?? null}
      initialBranding={company.branding ?? null}
      initialSessionPlan={company.sessionPlan?.payload ?? null}
      sessionGate={sessionGate}
      initialGraphNodes={graphNodes}
      initialGraphEdges={graphEdges}
      initialUserNotes={company.userNotes ?? ''}
    />
  );
}
