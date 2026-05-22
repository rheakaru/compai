'use client';

import type { OneLinerClaim } from '@/lib/model/claims';

/**
 * The hero — the sharpest sentence on the page, with the visual weight to
 * match. Framed quietly with a single short "What we see —" label, not a
 * heavy section header.
 *
 * Synthesis (the "read deeper" elaboration) is no longer rendered here;
 * it lives in PostureShift directly below as its own section. That way
 * the hero stays clean and the so-what beat reads as a real second
 * paragraph rather than something hidden behind a chevron.
 */
export function OneLiner({
  claim,
  streaming
}: {
  claim: OneLinerClaim | null;
  streaming: boolean;
}) {
  if (!claim) {
    return (
      <div className="px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm text-ink-400">
            {streaming ? 'Reading the shape…' : 'Paste a URL to start.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pt-10 pb-4 sm:pt-12">
      <div className="mx-auto max-w-4xl">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">What we see</p>
        <p
          className="mt-3 border-l-2 pl-5 text-[22px] font-medium leading-snug text-ink-900 sm:text-[26px]"
          style={{ borderColor: 'var(--brand, #c64a1f)' }}
        >
          {claim.content.sentence}
        </p>
        {claim.content.lowConfidence && (
          <p className="mt-3 pl-5 text-[11px] uppercase tracking-wider text-rose-700">
            Low-confidence hypothesis — sharpening as cards get corrected
          </p>
        )}
      </div>
    </div>
  );
}
