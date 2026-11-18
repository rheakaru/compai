import { cookies } from 'next/headers';
import { viewerFromRequest } from '@/lib/shared-docs/server';
import { WorkshopGate, WorkshopGuide } from '@/components/cos-workshop/WorkshopGuide';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Chief of Staff workshop — Rhai',
  description: 'Build your own AI chief of staff in a Claude project, then move it to Claude Code and WhatsApp. The two guides from the Rhai workshop.',
  robots: { index: false, follow: false }
};

export default async function ChiefOfStaffWorkshopPage() {
  const viewer = await viewerFromRequest({ cookies: await cookies() }).catch(() => null);
  return viewer ? <WorkshopGuide email={viewer.email} /> : <WorkshopGate />;
}
