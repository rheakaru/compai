import { KmcGuide } from '@/components/kmc-workshop/KmcGuide';

export const metadata = {
  title: 'KMC dashboard workshop — Rhai',
  description: 'Design your own KMC dashboard page with Claude: download the interview, answer one question at a time, and send Rhea three files.',
  robots: { index: false, follow: false }
};

// Fully public (no email or testimonial gate, unlike /chief-of-staff-workshop).
export default function KmcWorkshopPage() {
  return <KmcGuide />;
}
