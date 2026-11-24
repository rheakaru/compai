import { RoomGuest } from '@/components/rooms/RoomGuest';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Rhai — Join the room',
  robots: { index: false, follow: false }
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoomGuest roomId={id} />;
}
