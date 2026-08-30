import { OrientationReview } from '@/components/OrientationReview';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Intern orientation — review',
  robots: { index: false, follow: false }
};

export default function Page() {
  return <OrientationReview />;
}
