import { InterviewJobDetail } from '@/components/InterviewJobDetail';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Rhai — Role' };

export default async function InterviewJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <InterviewJobDetail jobId={jobId} />;
}
