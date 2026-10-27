import { SharedDocsAdmin } from '@/components/shared-docs/SharedDocsAdmin';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Rhai — shared docs',
  robots: { index: false, follow: false }
};

export default function Page() {
  return <SharedDocsAdmin />;
}
