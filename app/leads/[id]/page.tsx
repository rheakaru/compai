import { LeadWorkspace } from '@/components/LeadWorkspace';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Client workspace — Rhai'
};

export default async function LeadWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LeadWorkspace leadId={id} />;
}
