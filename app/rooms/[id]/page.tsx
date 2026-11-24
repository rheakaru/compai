import { RoomConsole } from '@/components/rooms/RoomConsole';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Rhai — Room console',
  robots: { index: false, follow: false }
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoomConsole roomId={id} />;
}
