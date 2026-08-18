import { VoiceTestimonial } from '@/components/VoiceTestimonial';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Rhai — leave a voice note',
  description: 'A quick voice testimonial about your Rhai session.'
};

export default function TestimonialPage() {
  return <VoiceTestimonial />;
}
