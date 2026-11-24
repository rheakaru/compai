import { RoomsHome } from '@/components/rooms/RoomsHome';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Rhai — Rooms',
  robots: { index: false, follow: false }
};

export default function Page() {
  return <RoomsHome />;
}
