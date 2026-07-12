import { HireJobWorkspace } from '@/components/HireJobWorkspace';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Rhai Interviews — Role' };

export default async function HireJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <HireJobWorkspace jobId={jobId} />;
}
