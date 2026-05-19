'use client';

import { useMemo } from 'react';
import type { RoleActivityClaim } from '@/lib/model/role';
import { ProvenanceBadge } from './ProvenanceBadge';

export function ActivityStream({ activities }: { activities: RoleActivityClaim[] }) {
  const grouped = useMemo(() => {
    const t = activities.filter(a => a.content.classification === 'translation');
    const j = activities.filter(a => a.content.classification === 'judgement');
    return { translation: t, judgement: j };
  }, [activities]);

  const total = activities.length;
  if (total === 0) {
    return <p className="text-xs text-ink-400">Listening for activities…</p>;
  }

  const trShare = grouped.translation.length / total;

  return (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          The activities we extracted
        </h3>
        <span className="text-[11px] text-ink-400">
          {total} {total === 1 ? 'activity' : 'activities'}
        </span>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full"
          style={{
            width: `${Math.round(trShare * 100)}%`,
            backgroundColor: 'var(--brand, #c64a1f)',
            opacity: 0.55
          }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-500">
        <span>{Math.round(trShare * 100)}% translation surface</span>
        <span>{Math.round((1 - trShare) * 100)}% judgement core</span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ActivityColumn label="Translation — the exposed surface" items={grouped.translation} />
        <ActivityColumn label="Judgement — what grows" items={grouped.judgement} />
      </div>
    </div>
  );
}

function ActivityColumn({
  label,
  items
}: {
  label: string;
  items: RoleActivityClaim[];
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-ink-500">{label}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-ink-400">none yet</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map(item => (
            <li key={item.id} className="rounded border border-ink-100 bg-ink-50/40 p-2">
              <p className="text-sm font-medium text-ink-900">{item.content.activity}</p>
              {item.content.evidence[0]?.quote && (
                <p className="mt-1 flex items-start gap-1.5 text-xs text-ink-600">
                  <ProvenanceBadge provenance={item.content.evidence[0].provenance} />
                  <span className="italic leading-snug">
                    &ldquo;{item.content.evidence[0].quote}&rdquo;
                  </span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
