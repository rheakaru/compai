import { ApplyChat } from '@/components/ApplyChat';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Interview — Rhai' };

export default async function ApplyPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <ApplyChat jobId={jobId} />;
}
