import type { HardProblemClaim } from '@/lib/model/claims';
import { getAxisLabel } from '@/lib/ontology/display-labels';

export function ProblemMap({ claims }: { claims: HardProblemClaim[] }) {
  if (claims.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-ink-400">
          The hot/dormant problem map will compute once the axis positions land.
        </p>
      </div>
    );
  }

  const hot = claims.filter(c => !c.content.isDormant);
  const dormant = claims.filter(c => c.content.isDormant);
  const topWeight = hot[0]?.content.weight ?? 1;

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          Hot — what your structure makes load-bearing
        </h3>
        <ol className="mt-3 space-y-2.5">
          {hot.map((c, i) => {
            const strength = Math.max(0.18, Math.min(1, c.content.weight / topWeight));
            const sources = c.content.sources ?? [];
            const isInteraction = sources.includes('interaction');
            const hasDeviation = sources.includes('deviation');
            const firings = c.content.interactionFirings ?? [];
            const firstFiring = firings[0];
            const axisLabels = (c.content.voterAxes ?? [])
              .slice(0, 3)
              .map(id => getAxisLabel(id, id).handle || id);

            return (
              <li key={c.id} className="rounded px-1.5 py-1">
                <div className="flex items-baseline gap-3">
                  <span className="w-4 flex-none text-right text-[11px] text-ink-300">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900">
                      {prettify(c.content.problemId)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                      {isInteraction && (
                        <span
                          className="rounded px-1.5 py-0.5 font-medium uppercase tracking-wider text-white"
                          style={{ backgroundColor: 'var(--brand, #c64a1f)' }}
                        >
                          interaction
                        </span>
                      )}
                      {hasDeviation && !isInteraction && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium uppercase tracking-wider text-amber-900">
                          deviation
                        </span>
                      )}
                      {!isInteraction && !hasDeviation && (
                        <span className="rounded bg-ink-100 px-1.5 py-0.5 font-medium uppercase tracking-wider text-ink-600">
                          position
                        </span>
                      )}
                      {firstFiring?.source === 'agent_hypothesis' && (
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 font-medium uppercase tracking-wider text-rose-900">
                          hypothesis
                        </span>
                      )}
                      <span className="text-ink-400">
                        {isInteraction && firstFiring
                          ? firstFiring.axes
                              .map(id => getAxisLabel(id, id).handle || id)
                              .join(' × ')
                          : axisLabels.join(' · ')}
                      </span>
                    </div>
                    {firstFiring?.mechanism && (
                      <p className="mt-1.5 text-[12px] italic leading-snug text-ink-600">
                        {firstFiring.mechanism}
                      </p>
                    )}
                  </div>
                  <span
                    className="mt-1 h-1.5 w-16 flex-none rounded-full"
                    style={{ backgroundColor: 'var(--brand, #c64a1f)', opacity: strength }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {dormant.length > 0 && (
        <div className="card opacity-70">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
            Dormant — what to ignore for this shape
          </h3>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {dormant.map(c => (
              <li
                key={c.id}
                className="rounded border border-ink-200 bg-ink-50 px-2 py-0.5 text-[11px] text-ink-500 line-through decoration-ink-300"
              >
                {prettify(c.content.problemId)}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-ink-400">
            Showing what to ignore is half the value — these matter for other shapes, not yours.
          </p>
        </div>
      )}
    </div>
  );
}

function prettify(id: string): string {
  return id.replace(/_/g, ' ');
}
