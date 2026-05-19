import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase/admin';
import { loadOntology } from '@/lib/ontology/loader';
import { Profile } from '@/components/Profile';
import type { BrandingSnapshot, Claim, CompanyDoc } from '@/lib/model/claims';
import type { FiveProjects } from '@/lib/agent/projects';

export const dynamic = 'force-dynamic';

interface PersistedCompanyDoc extends CompanyDoc {
  branding?: BrandingSnapshot | null;
  projects?: {
    generatedAt: number;
    payload: FiveProjects;
  };
}

export default async function CompanyPage({
  params
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const { ontology } = loadOntology();

  const companyRef = adminDb().collection('companies').doc(companyId);
  const companySnap = await companyRef.get();
  if (!companySnap.exists) {
    notFound();
  }
  const company = companySnap.data() as PersistedCompanyDoc;

  const claimsSnap = await companyRef.collection('claims').get();
  const claims = claimsSnap.docs.map(d => d.data() as Claim);

  return (
    <Profile
      initialClaims={claims}
      ontology={ontology}
      companyId={companyId}
      companyUrl={company.url}
      initialProjects={company.projects?.payload ?? null}
      initialBranding={company.branding ?? null}
    />
  );
}
