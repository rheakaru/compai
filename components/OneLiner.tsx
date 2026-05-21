'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { OneLinerClaim, SynthesisClaim } from '@/lib/model/claims';

export function OneLiner({
  claim,
  synthesis,
  streaming
}: {
  claim: OneLinerClaim | null;
  synthesis: SynthesisClaim | null;
  streaming: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

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

          {synthesis && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-ink-500 hover:text-ink-800"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" /> less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" /> read deeper
                  </>
                )}
              </button>
              {expanded && (
                <div className="mt-2 text-[14px] leading-relaxed text-ink-700">
                  {synthesis.content.text.split('\n\n').map((p, i) => (
                    <p key={i} className={i > 0 ? 'mt-2' : ''}>
                      {p}
                    </p>
                  ))}
                  {synthesis.content.lowConfidence && (
                    <p className="mt-2 text-[11px] uppercase tracking-wider text-rose-700">
                      Low confidence — based on sparse evidence
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
