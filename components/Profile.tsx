'use client';

import { useMemo } from 'react';
import type {
  AxisPositionClaim,
  Claim,
  FactClaim,
  HardProblemClaim,
  OneLinerClaim
} from '@/lib/model/claims';
import type { Ontology } from '@/lib/ontology/types';
import { OneLiner } from './OneLiner';
import { AxisCard } from './AxisCard';
import { ProblemMap } from './ProblemMap';
import { ProvenanceBadge } from './ProvenanceBadge';

export function Profile({
  claims,
  ontology,
  streaming
}: {
  claims: Claim[];
  ontology: Ontology;
  streaming: boolean;
}) {
  const live = useMemo(() => claims.filter(c => c.supersededBy === null), [claims]);

  const oneLiner = useMemo(() => {
    const all = live.filter((c): c is OneLinerClaim => c.kind === 'one_liner');
    return all.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  }, [live]);

  const facts = useMemo(() => live.filter((c): c is FactClaim => c.kind === 'fact'), [live]);
  const axisClaims = useMemo(
    () => live.filter((c): c is AxisPositionClaim => c.kind === 'axis_position'),
    [live]
  );
  const hardProblems = useMemo(
    () => live.filter((c): c is HardProblemClaim => c.kind === 'hard_problem'),
    [live]
  );

  const axisClaimByAxisId = useMemo(() => {
    const m = new Map<string, AxisPositionClaim>();
    for (const c of axisClaims) {
      const existing = m.get(c.content.axisId);
      if (!existing || c.createdAt > existing.createdAt) m.set(c.content.axisId, c);
    }
    return m;
  }, [axisClaims]);

  const sortedAxes = useMemo(
    () => [...ontology.axes].sort((a, b) => a.load_bearing_rank - b.load_bearing_rank),
    [ontology]
  );

  const loadBearing = sortedAxes.filter(a => a.load_bearing_rank <= 5);
  const refining = sortedAxes.filter(a => a.load_bearing_rank > 5);

  return (
    <div className="min-h-screen">
      <OneLiner claim={oneLiner} streaming={streaming} />

      <div className="mx-auto max-w-4xl space-y-10 px-6 py-8">
        <section>
          <SectionHeader
            title="Shape"
            subtitle="Where this company sits on the 9 structural axes — each with the evidence it rests on."
          />
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-ink-400">Load-bearing</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {loadBearing.map(axis => (
                <AxisCard
                  key={axis.id}
                  axis={axis}
                  claim={axisClaimByAxisId.get(axis.id) ?? null}
                />
              ))}
            </div>
            <p className="mt-6 text-[11px] uppercase tracking-wider text-ink-400">Refining</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {refining.map(axis => (
                <AxisCard
                  key={axis.id}
                  axis={axis}
                  claim={axisClaimByAxisId.get(axis.id) ?? null}
                />
              ))}
            </div>
          </div>
        </section>

        <section>
          <SectionHeader
            title="What's hard for this shape"
            subtitle="Computed from the axis positions. Hot problems are what your structure makes load-bearing — not a vibe."
          />
          <ProblemMap claims={hardProblems} />
        </section>

        {facts.length > 0 && (
          <section>
            <SectionHeader
              title="What we found"
              subtitle="Raw facts the agent gathered, with provenance. Click any to correct it (coming next phase)."
            />
            <ul className="space-y-2">
              {facts.map(f => (
                <li key={f.id} className="card flex items-start gap-2 text-sm">
                  <ProvenanceBadge provenance={f.provenance} />
                  <span className="flex-1 text-ink-700">
                    {f.content.statement}
                    {f.content.source && (
                      <span className="ml-1 text-xs text-ink-400">· {truncate(f.content.source)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold text-ink-900">{title}</h2>
      <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
    </div>
  );
}

function truncate(s: string): string {
  if (s.length <= 48) return s;
  try {
    const u = new URL(s);
    return u.hostname;
  } catch {
    return s.slice(0, 48) + '…';
  }
}
