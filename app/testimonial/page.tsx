import { VoiceTestimonial } from '@/components/VoiceTestimonial';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Hang w AI — leave a voice note',
  description: 'A quick voice testimonial about your Hang with AI session.'
};

export default function TestimonialPage() {
  return <VoiceTestimonial />;
}
