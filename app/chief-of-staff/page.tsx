import { ChiefOfStaffBuilder } from '@/components/cos/ChiefOfStaffBuilder';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Build your Chief of Staff — Rhai',
  description:
    'Design your own AI chief of staff in a short interview, connect your calendar and email, and talk to it on WhatsApp. From the Rhai workshop.'
};

export default function ChiefOfStaffPage() {
  return <ChiefOfStaffBuilder />;
}
