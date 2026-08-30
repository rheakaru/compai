import { ResourcesLibrary } from '@/components/ResourcesLibrary';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Rhai — team learning resources',
  robots: { index: false, follow: false }
};

export default function Page() {
  return <ResourcesLibrary />;
}
