'use client';

import type { AxisPositionClaim } from '@/lib/model/claims';
import type { Ontology } from '@/lib/ontology/types';

export function OpenQuestionsPanel({
  axisClaims,
  ontology,
  onAnswer
}: {
  axisClaims: AxisPositionClaim[];
  ontology: Ontology;
  onAnswer: (axisId: string) => void;
}) {
  const open = axisClaims
    .filter(c => c.content.confidence < 0.6 && c.content.disambiguatingQuestion)
    .map(c => {
      const axis = ontology.axes.find(a => a.id === c.content.axisId);
      return {
        claim: c,
        rank: axis?.load_bearing_rank ?? 99,
        axisName: axis?.name ?? c.content.axisId,
        question: c.content.disambiguatingQuestion!
      };
    })
    .sort((a, b) => a.rank - b.rank);

  if (open.length === 0) return null;
  const top = open[0];

  return (
    <div className="card border-l-4 border-l-amber-400 bg-amber-50/40">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-amber-800">
          Most load-bearing open question · {top.axisName}
        </span>
        {open.length > 1 && (
          <span className="text-[11px] text-amber-700">
            {open.length - 1} more after this
          </span>
        )}
      </div>
      <p className="mt-2 text-[15px] leading-snug text-ink-900">{top.question}</p>
      <div className="mt-3 flex items-center justify-end">
        <button
          type="button"
          onClick={() => onAnswer(top.claim.content.axisId)}
          className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
        >
          Answer this →
        </button>
      </div>
    </div>
  );
}
