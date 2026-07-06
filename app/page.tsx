import { RhaiHome } from '@/components/RhaiHome';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Rhai — AI that runs inside your business',
  description:
    'Rhai is an AI practice for founders. We teach your team to build with AI, and we build the intelligence dashboards that use it. You own everything from minute one.'
};

export default function HomePage() {
  return <RhaiHome />;
}
