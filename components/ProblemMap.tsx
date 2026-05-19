import type { HardProblemClaim } from '@/lib/model/claims';

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
        <ol className="mt-3 space-y-1.5">
          {hot.map((c, i) => {
            const strength = Math.max(0.18, Math.min(1, c.content.weight / topWeight));
            return (
              <li
                key={c.id}
                className="group flex items-center gap-3 rounded px-1.5 py-1 text-sm hover:bg-ink-50"
                title={`voted by ${c.content.voterAxes.length} axes · weight ${c.content.weight.toFixed(1)}`}
              >
                <span className="w-4 text-right text-[11px] text-ink-300">{i + 1}</span>
                <span className="flex-1 font-medium text-ink-900">
                  {prettify(c.content.problemId)}
                </span>
                <span
                  className="h-1.5 w-16 rounded-full"
                  style={{ backgroundColor: 'var(--brand, #c64a1f)', opacity: strength }}
                />
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
