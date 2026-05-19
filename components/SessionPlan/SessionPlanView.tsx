'use client';

import type { SessionPlanContent } from '@/lib/agent/session-plan';

const FIXED_FRAME_NOTE =
  'The arc is constant — every session uses the same six beats. What fills each beat below is yours.';

export function SessionPlanView({ plan }: { plan: SessionPlanContent }) {
  return (
    <div className="space-y-6">
      <p className="text-xs text-ink-500">{FIXED_FRAME_NOTE}</p>

      <ol className="space-y-4">
        {plan.beats.map((b, i) => (
          <li
            key={b.beat}
            className="card relative pl-12"
            data-beat={b.beat}
          >
            <span
              className="absolute left-3 top-4 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ backgroundColor: 'var(--brand, #c64a1f)' }}
            >
              {i + 1}
            </span>
            <h3 className="text-[15px] font-semibold text-ink-900">{b.beatHeading}</h3>
            {b.beatSourceLine && (
              <p className="mt-1 text-[11px] italic text-ink-500">"{b.beatSourceLine}"</p>
            )}
            <p className="mt-2.5 text-[15px] leading-relaxed text-ink-800">{b.inhabited}</p>
            {b.references.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {b.references.map((ref, j) => (
                  <span
                    key={j}
                    className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-mono text-ink-600"
                  >
                    {ref}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="card border-l-4" style={{ borderLeftColor: 'var(--brand, #c64a1f)' }}>
        <p className="text-[11px] uppercase tracking-wider text-ink-500">
          The close — diagnosis, session, the irreducible human
        </p>
        <div className="mt-3 space-y-3">
          <ClosePoint
            label="Understanding"
            note="The free diagnosis already gave you this."
            body={plan.closingSpine.diagnosisUnderstanding}
          />
          <ClosePoint
            label="Building"
            note="The session is where you build on top."
            body={plan.closingSpine.sessionBuilding}
          />
          <ClosePoint
            label="The irreducible human"
            note="The one thing you cannot outsource — also the single non-negotiable on the session offer."
            body={plan.closingSpine.irreducibleHuman}
          />
        </div>
        <p className="mt-5 text-xs italic text-ink-500">
          You can outsource your thinking. You can&apos;t outsource your understanding.
        </p>
      </div>

      {plan.drivers.length > 0 && (
        <details className="card group">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-ink-500">
            What in your diagnosis drove this plan
            <span className="ml-2 text-ink-400 group-open:hidden">show</span>
            <span className="ml-2 hidden text-ink-400 group-open:inline">hide</span>
          </summary>
          <ul className="mt-3 space-y-1.5 text-xs text-ink-600">
            {plan.drivers.map((d, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-ink-400" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ClosePoint({
  label,
  note,
  body
}: {
  label: string;
  note: string;
  body: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</p>
      <p className="text-[11px] text-ink-400">{note}</p>
      <p className="mt-1 text-[15px] leading-relaxed text-ink-800">{body}</p>
    </div>
  );
}
