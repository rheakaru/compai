import { InterviewChat } from '@/components/InterviewChat';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Interview — Rhai'
};

export default async function InterviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <InterviewChat slug={slug} />;
}
