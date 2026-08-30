import { ActiveClients } from '@/components/ActiveClients';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Rhai — active clients',
  robots: { index: false, follow: false }
};

export default function Page() {
  return <ActiveClients />;
}
