import { cookies } from 'next/headers';
import { passFromCookies } from '@/lib/cos-workshop/server';
import { WorkshopGuide } from '@/components/cos-workshop/WorkshopGuide';
import { WorkshopUnlock } from '@/components/cos-workshop/WorkshopUnlock';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Chief of Staff workshop — Rhai',
  description: 'Build your own AI chief of staff in a Claude project, then move it to Claude Code and WhatsApp. The two guides from the Rhai workshop.',
  robots: { index: false, follow: false }
};

// Locked behind a voice testimonial: leave a real one (checked for junk) and
// the guide opens. See app/api/testimonial/route.ts.
export default async function ChiefOfStaffWorkshopPage() {
  const pass = await passFromCookies(await cookies()).catch(() => null);
  return pass ? <WorkshopGuide name={pass.name} /> : <WorkshopUnlock />;
}
