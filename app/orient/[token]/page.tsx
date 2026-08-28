import { notFound } from 'next/navigation';
import { InternOnboarding } from '@/components/InternOnboarding';
import { ONBOARDING_TOKEN } from '@/lib/rhai/onboarding';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Welcome to Rhai — Orientation',
  robots: { index: false, follow: false }
};

// Token in the URL is the credential. A wrong token 404s rather than revealing
// anything. The page itself re-checks the token on every API call.
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token !== ONBOARDING_TOKEN) notFound();
  return <InternOnboarding />;
}
