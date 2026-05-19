import type { AxisPositionClaim } from '@/lib/model/claims';
import type { Axis } from '@/lib/ontology/types';
import { ProvenanceBadge } from './ProvenanceBadge';

export function AxisCard({ axis, claim }: { axis: Axis; claim: AxisPositionClaim | null }) {
  const isLoadBearing = axis.load_bearing_rank <= 5;
  const lowConfidence = claim ? claim.content.confidence < 0.6 : false;

  return (
    <div
      className={`card ${isLoadBearing ? 'ring-1 ring-ink-300' : 'opacity-90'}`}
      data-axis={axis.id}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-900">{axis.name}</h3>
        <span className="text-[10px] uppercase tracking-wide text-ink-400">
          {isLoadBearing ? `Load-bearing · #${axis.load_bearing_rank}` : `Refining · #${axis.load_bearing_rank}`}
        </span>
      </div>

      {!claim ? (
        <p className="mt-2 text-sm text-ink-400">Reading…</p>
      ) : lowConfidence && claim.content.candidateA && claim.content.candidateB ? (
        <div className="mt-2 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-rose-700">
            Evidence is thin — two plausible reads
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <CandidateBlock
              label="A"
              position={claim.content.candidateA.position}
              implication={claim.content.candidateA.implication}
            />
            <CandidateBlock
              label="B"
              position={claim.content.candidateB.position}
              implication={claim.content.candidateB.implication}
            />
          </div>
          {claim.content.disambiguatingQuestion && (
            <p className="text-sm font-medium text-ink-800">
              <span className="text-ink-400">Q · </span>
              {claim.content.disambiguatingQuestion}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[15px] font-medium text-ink-900">{claim.content.position}</p>
      )}

      {claim && claim.content.evidence.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-ink-100 pt-3">
          {claim.content.evidence.map((e, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-ink-600">
              <ProvenanceBadge provenance={e.provenance} />
              <span className="leading-snug">
                {e.quote}
                {e.source && (
                  <span className="ml-1 text-ink-400">· {truncateSource(e.source)}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CandidateBlock({
  label,
  position,
  implication
}: {
  label: string;
  position: string;
  implication: string;
}) {
  return (
    <div className="rounded border border-ink-200 bg-ink-50 p-2">
      <p className="text-[10px] uppercase tracking-wide text-ink-400">If {label} · {position}</p>
      <p className="mt-1 text-xs leading-snug text-ink-700">{implication}</p>
    </div>
  );
}

function truncateSource(s: string): string {
  if (s.length <= 36) return s;
  try {
    const u = new URL(s);
    return u.hostname;
  } catch {
    return s.slice(0, 36) + '…';
  }
}
