import { TaskDetail } from '@/components/TaskDetail';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Rhai — Task' };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TaskDetail id={id} />;
}
