'use client';

import { useEffect, useRef } from 'react';
import type { ConnectorMapResult } from '@/lib/model/connector-map';
import type { ConnectorMapConfig } from '@/lib/ontology/types';

/**
 * Renders the connector map. Either:
 *   - a numbered list of populated wires (capped server-side at max_connections), or
 *   - an honest stop card (no fabrication), with the booking pitch.
 *
 * Logs `connector_map_viewed` on mount; `connector_map_honest_stop` when there
 * are zero wires for this shape.
 */
export function ConnectorMap({
  result,
  framing,
  companyId,
  companyUrl
}: {
  result: ConnectorMapResult;
  framing: ConnectorMapConfig['framing'];
  companyId: string | null;
  companyUrl?: string | null;
}) {
  const loggedRef = useRef(false);
  useEffect(() => {
    if (loggedRef.current || !companyId) return;
    loggedRef.current = true;
    fetch('/api/funnel/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        stage: 'connector_map_viewed',
        companyId,
        companyUrl: companyUrl ?? null,
        meta: {
          wireCount: result.wires.length,
          honestStop: result.honestStop,
          patternsPopulated: result.patternsPopulated
        }
      })
    }).catch(() => undefined);
    if (result.honestStop) {
      fetch('/api/funnel/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          stage: 'connector_map_honest_stop',
          companyId,
          companyUrl: companyUrl ?? null,
          meta: { patternsPopulated: result.patternsPopulated }
        })
      }).catch(() => undefined);
    }
  }, [companyId, companyUrl, result.wires.length, result.honestStop, result.patternsPopulated]);

  return (
    <section>
      <p className="text-base font-semibold text-ink-900">{framing.headline}</p>
      <p className="mt-0.5 text-xs text-ink-500">{framing.narrative_link_to_export.trim()}</p>

      {result.honestStop ? (
        <div className="mt-3 rounded border border-dashed border-ink-300 bg-ink-50 p-4">
          <p className="text-sm font-medium text-ink-800">
            We see your shape clearly. The specific wires for THIS shape are exactly what the workshop builds.
          </p>
          <p className="mt-2 text-xs text-ink-600">
            The connector map only shows integrations we&apos;ve already traced for a matching shape — we
            don&apos;t fabricate wires. Yours isn&apos;t in the populated set yet, so the right
            connections get named live, with your team in the room.
          </p>
        </div>
      ) : (
        <ol className="mt-3 space-y-3">
          {result.wires.map((wire, i) => (
            <li
              key={`${wire.patternId}-${i}`}
              className="rounded border border-ink-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-baseline gap-2">
                <span
                  className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-semibold text-white"
                  style={{ backgroundColor: 'var(--brand, #c64a1f)' }}
                >
                  {i + 1}
                </span>
                <p className="text-sm font-medium text-ink-900">
                  <span>{wire.from}</span>
                  <span className="mx-1.5 text-ink-400">→</span>
                  <span>{wire.to}</span>
                </p>
              </div>
              <div className="mt-2 grid gap-1.5 pl-7 text-xs text-ink-700 sm:grid-cols-[auto_1fr] sm:gap-x-3">
                <span className="font-semibold uppercase tracking-wider text-ink-500">Via</span>
                <span>{wire.via}</span>
                <span className="font-semibold uppercase tracking-wider text-ink-500">Leverage</span>
                <span>{wire.leverage}</span>
                <span className="font-semibold uppercase tracking-wider text-ink-500">Unlocks</span>
                <span>{wire.what_it_unlocks}</span>
              </div>
              {wire.seenIn && (
                <p className="mt-2 pl-7 text-[11px] text-ink-400">seen in: {wire.seenIn}</p>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 rounded border border-ink-100 bg-ink-50/60 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-600">
          From map to build
        </p>
        <p className="mt-1 text-xs text-ink-700">{framing.booking_pitch.trim()}</p>
        <a
          href="https://rheakaru.github.io/sessions.html"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium hover:opacity-80"
          style={{ color: 'var(--brand, #c64a1f)' }}
        >
          Book a session →
        </a>
      </div>
    </section>
  );
}
