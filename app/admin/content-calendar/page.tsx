import { ContentCalendarBoard } from '@/components/ContentCalendarBoard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Rhai — content calendar',
  robots: { index: false, follow: false }
};

export default function Page() {
  return <ContentCalendarBoard />;
}
