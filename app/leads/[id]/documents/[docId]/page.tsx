import { DocumentDetail } from '@/components/DocumentDetail';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Rhai — Document' };

export default async function DocumentPage({ params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  return <DocumentDetail leadId={id} docId={docId} />;
}
