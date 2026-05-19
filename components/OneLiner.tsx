import type { OneLinerClaim } from '@/lib/model/claims';

export function OneLiner({ claim, streaming }: { claim: OneLinerClaim | null; streaming: boolean }) {
  if (!claim) {
    return (
      <div className="sticky top-0 z-10 border-b border-ink-200 bg-ink-50/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm text-ink-400">
            {streaming ? 'Reading the shape…' : 'Paste a URL to start.'}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="sticky top-0 z-10 border-b border-ink-200 bg-ink-50/95 px-6 py-4 backdrop-blur">
      <div className="mx-auto max-w-4xl">
        <div
          className="border-l-2 pl-4"
          style={{ borderColor: 'var(--brand, #c64a1f)' }}
        >
          <p className="text-[17px] leading-snug text-ink-900 sm:text-lg">
            {claim.content.sentence}
          </p>
          {claim.content.lowConfidence && (
            <p className="mt-1 text-[11px] uppercase tracking-wider text-rose-700">
              Low-confidence hypothesis — sharpen by correcting axes below
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
