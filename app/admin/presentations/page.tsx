import { PresentationsGallery } from '@/components/PresentationsGallery';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Rhai — presentations',
  robots: { index: false, follow: false }
};

export default function Page() {
  return <PresentationsGallery />;
}
