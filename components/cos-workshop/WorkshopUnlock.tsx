'use client';

// The locked state of /chief-of-staff-workshop: what's inside, and the voice
// testimonial recorder that opens it. A genuine note sets the pass cookie
// server-side; we then refresh so the page re-renders as the guide.

import { useRouter } from 'next/navigation';
import { VoiceTestimonial } from '@/components/VoiceTestimonial';

export function WorkshopUnlock() {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:py-14">
      <p className="eyebrow text-center">Rhai workshop · Chief of Staff</p>
      <h1 className="mt-2 text-center font-display text-3xl tracking-tight text-ink-900">Build your own chief of staff.</h1>
      <p className="mx-auto mt-3 max-w-md text-center text-[15px] leading-relaxed text-ink-600">
        The step-by-step guide and both setup files: build a chief of staff in a Claude project, then move it to Claude
        Code and WhatsApp.
      </p>
      <div className="mt-8">
        <VoiceTestimonial unlock onUnlocked={() => setTimeout(() => router.refresh(), 1200)} />
      </div>
    </main>
  );
}
