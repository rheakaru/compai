'use client';

import type { CareerStrategyContent } from '@/lib/model/role';

export function CareerStrategyView({ strategy }: { strategy: CareerStrategyContent }) {
  return (
    <div className="space-y-6">
      <div className="card border-l-4" style={{ borderLeftColor: 'var(--brand, #c64a1f)' }}>
        <p className="text-[11px] uppercase tracking-wider text-ink-500">Your career strategy</p>

        <div className="mt-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
            The exposed surface, plainly
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-800">
            {strategy.exposedSurface}
          </p>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
            The judgement core — what grows
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-800">
            {strategy.judgementCore}
          </p>
        </div>
      </div>

      <div className="card">
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: 'var(--brand, #c64a1f)' }}
        >
          Concrete moves toward judgement
        </h3>
        <ol className="mt-3 space-y-2.5">
          {strategy.movesTowardJudgement.map((move, i) => (
            <li key={i} className="flex items-start gap-3 text-[15px] text-ink-800">
              <span
                className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-semibold text-white"
                style={{ backgroundColor: 'var(--brand, #c64a1f)' }}
              >
                {i + 1}
              </span>
              <span className="leading-relaxed">{move}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
          AI in your role — accelerators
        </h3>
        <ul className="mt-3 space-y-2">
          {strategy.aiInRoleTips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
              <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-ink-400" />
              <span className="leading-relaxed">{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[15px] italic leading-relaxed text-ink-700">{strategy.closingNote}</p>
    </div>
  );
}
