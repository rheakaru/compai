import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase/admin';
import { loadOntology } from '@/lib/ontology/loader';
import { Profile } from '@/components/Profile';
import type { Claim, CompanyDoc } from '@/lib/model/claims';

export const dynamic = 'force-dynamic';

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
  const company = companySnap.data() as CompanyDoc;

  const claimsSnap = await companyRef.collection('claims').get();
  const claims = claimsSnap.docs.map(d => d.data() as Claim);

  return (
    <div className="min-h-screen">
      <div className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-baseline justify-between gap-4 px-6 py-3 text-xs text-ink-500">
          <span className="truncate">{company.url}</span>
          <a href="/" className="text-ink-400 hover:text-ink-700">
            ← new
          </a>
        </div>
      </div>
      <Profile claims={claims} ontology={ontology} streaming={false} />
    </div>
  );
}
