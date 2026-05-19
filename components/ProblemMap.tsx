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

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
          Hot · what's typically hard for this shape
        </h3>
        <ol className="mt-3 space-y-2">
          {hot.map((c, i) => (
            <li key={c.id} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 w-4 text-right text-ink-400">{i + 1}</span>
              <span className="flex-1">
                <span className="font-medium text-ink-900">{prettify(c.content.problemId)}</span>
                <span className="ml-2 text-xs text-ink-400">
                  voted by {c.content.voterAxes.length}{' '}
                  {c.content.voterAxes.length === 1 ? 'axis' : 'axes'} · weight{' '}
                  {c.content.weight.toFixed(1)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      {dormant.length > 0 && (
        <div className="card opacity-70">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            Dormant · what to ignore for this shape
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {dormant.map(c => (
              <li
                key={c.id}
                className="rounded border border-ink-200 bg-ink-50 px-2 py-1 text-xs text-ink-500 line-through decoration-ink-300"
              >
                {prettify(c.content.problemId)}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-ink-400">
            Showing what to IGNORE is half the value. These problems matter for other shapes — not yours.
          </p>
        </div>
      )}
    </div>
  );
}

function prettify(id: string): string {
  return id.replace(/_/g, ' ');
}
