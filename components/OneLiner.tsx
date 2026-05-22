'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { OneLinerClaim, SynthesisClaim } from '@/lib/model/claims';
import { useAuth } from './AuthProvider';

export function OneLiner({
  claim,
  synthesis,
  streaming,
  companyId,
  canFetchSynthesis = false
}: {
  claim: OneLinerClaim | null;
  synthesis: SynthesisClaim | null;
  streaming: boolean;
  companyId?: string | null;
  /** Whether the current viewer (owner + signed in) can trigger a synthesis
   *  generation for companies that don't have one yet. */
  canFetchSynthesis?: boolean;
}) {
  const { getToken } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [lazySynthesis, setLazySynthesis] = useState<SynthesisClaim | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedSynthesis = synthesis ?? lazySynthesis;

  // Show the "read deeper" affordance whenever:
  //   - a synthesis exists already, OR
  //   - the viewer is allowed to fetch one (signed-in owner) for a company
  //     that doesn't have one yet — synthesis was added late, so old
  //     companies need a path to generate it on demand without re-running
  //     the full analysis.
  const showChevron =
    !streaming && (!!resolvedSynthesis || (canFetchSynthesis && !!companyId));

  const onToggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (resolvedSynthesis || !companyId || !canFetchSynthesis) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/companies/${companyId}/synthesis`, {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { claim?: SynthesisClaim };
      if (data.claim) setLazySynthesis(data.claim);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

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

          {showChevron && (
            <div className="mt-2">
              <button
                type="button"
                onClick={onToggle}
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
                  {loading && !resolvedSynthesis && (
                    <p className="text-ink-400">Writing the deeper read…</p>
                  )}
                  {error && (
                    <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                      {error}
                    </p>
                  )}
                  {resolvedSynthesis &&
                    resolvedSynthesis.content.text.split('\n\n').map((p, i) => (
                      <p key={i} className={i > 0 ? 'mt-2' : ''}>
                        {p}
                      </p>
                    ))}
                  {resolvedSynthesis?.content.lowConfidence && (
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
