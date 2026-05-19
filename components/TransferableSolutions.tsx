'use client';

import { useMemo } from 'react';
import type { AxisPositionClaim } from '@/lib/model/claims';
import type { Ontology } from '@/lib/ontology/types';
import { matchAnalogy } from '@/lib/model/analogy';

export function TransferableSolutions({
  axisClaims,
  ontology
}: {
  axisClaims: AxisPositionClaim[];
  ontology: Ontology;
}) {
  const match = useMemo(() => matchAnalogy(axisClaims, ontology), [axisClaims, ontology]);

  // Above the strict floor — show CLEAN. No confidence label, no numeric score, no hedge.
  if (match && match.aboveFloor) {
    const e = match.entry;
    return (
      <div className="card border-l-4 border-l-emerald-500">
        <p className="text-[15px] italic leading-relaxed text-ink-900">{e.posture_shift}</p>
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-wider text-ink-500">Solved domains</p>
          <ul className="mt-2 space-y-2">
            {e.solved_domains.map((d, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium text-ink-900">{d.domain}</span>
                <span className="text-ink-600"> — transfers: {d.transfers}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 rounded bg-ink-50 p-3">
          <p className="text-[11px] uppercase tracking-wider text-ink-500">
            The residue · what differs · the actual project
          </p>
          <p className="mt-1 text-sm text-ink-800">{e.residue}</p>
        </div>
      </div>
    );
  }

  // Below the floor — HONEST STOP. No analogy. No hedge. No fabrication.
  return (
    <div className="card border-l-4 border-l-amber-500">
      <p className="text-[15px] text-ink-900">
        Your shape is clear — you can see it above. Mapping it to the specific solved domains that
        unlock solutions is exactly what the workshop does. The gap is the work.
      </p>
      <a
        href="https://rheakaru.github.io/sessions.html"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
      >
        Book a session →
      </a>
    </div>
  );
}
