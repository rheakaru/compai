'use client';

import { useEffect, useState } from 'react';

export interface DiffSummary {
  beforeOneLiner?: string | null;
  afterOneLiner?: string | null;
  axisName?: string;
  beforePosition?: string;
  afterPosition?: string;
  newProblemsAdded?: number;
  problemsDropped?: number;
}

export function WhatChanged({ diff }: { diff: DiffSummary | null }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!diff) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 15000);
    return () => clearTimeout(t);
  }, [diff]);

  if (!diff || !visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-30 w-[360px] rounded-lg border border-ink-200 bg-white p-4 shadow-lg">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink-900">What changed</h3>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="text-xs text-ink-400 hover:text-ink-700"
        >
          dismiss
        </button>
      </div>
      <ul className="mt-2 space-y-2 text-xs text-ink-700">
        {diff.axisName && (
          <li>
            <span className="font-medium">{diff.axisName}:</span>{' '}
            <span className="text-ink-400 line-through">{diff.beforePosition}</span>{' '}
            → <span className="text-ink-900">{diff.afterPosition}</span>
          </li>
        )}
        {diff.beforeOneLiner !== diff.afterOneLiner && diff.afterOneLiner && (
          <li>
            <span className="font-medium">One-liner re-derived.</span>
            <div className="mt-1 rounded bg-ink-50 p-2 italic text-ink-700">
              {diff.afterOneLiner}
            </div>
          </li>
        )}
        {(diff.newProblemsAdded || diff.problemsDropped) && (
          <li className="text-ink-500">
            Problem map shifted{' '}
            {diff.newProblemsAdded ? `(+${diff.newProblemsAdded} hot)` : ''}
            {diff.problemsDropped ? ` (-${diff.problemsDropped})` : ''}.
          </li>
        )}
      </ul>
    </div>
  );
}
