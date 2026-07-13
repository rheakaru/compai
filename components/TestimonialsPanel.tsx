'use client';

// Operator curation of the voice testimonials that come in from /testimonial.
// Play each, read the transcript, toggle whether it shows on heyrhai.com, drag
// the shown ones into order, delete junk.

import { useCallback, useEffect, useState } from 'react';
import { useAuthedFetch } from './useAuthedFetch';
import type { Testimonial } from '@/lib/rhai/testimonials';

export function TestimonialsPanel() {
  const authedFetch = useAuthedFetch();
  const [items, setItems] = useState<Testimonial[] | null>(null);

  const load = useCallback(async () => {
    const res = await authedFetch('/api/rhai/testimonials');
    if (res.ok) setItems(((await res.json()) as { testimonials: Testimonial[] }).testimonials);
  }, [authedFetch]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const shown = (items ?? []).filter(t => t.displayed);
  const hidden = (items ?? []).filter(t => !t.displayed);

  const setDisplayed = async (id: string, displayed: boolean) => {
    setItems(prev => (prev ? prev.map(t => (t.id === id ? { ...t, displayed, order: displayed ? shown.length : t.order } : t)) : prev));
    await authedFetch('/api/rhai/testimonials', { method: 'PATCH', body: JSON.stringify({ id, displayed }) }).catch(() => undefined);
    load().catch(() => undefined);
  };

  const move = async (id: string, dir: -1 | 1) => {
    const list = [...shown];
    const i = list.findIndex(t => t.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setItems(prev => (prev ? [...list, ...hidden] : prev));
    await authedFetch('/api/rhai/testimonials', { method: 'PUT', body: JSON.stringify({ orderedIds: list.map(t => t.id) }) }).catch(() => undefined);
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this testimonial permanently?')) return;
    setItems(prev => (prev ? prev.filter(t => t.id !== id) : prev));
    await authedFetch(`/api/rhai/testimonials?id=${id}`, { method: 'DELETE' }).catch(() => undefined);
  };

  if (items === null) return <p className="text-sm text-ink-400">Loading…</p>;
  if (items.length === 0)
    return (
      <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
        No voice notes yet — share <span className="font-mono text-ink-600">heyrhai.com/testimonial</span> in the Hang w AI group.
      </p>
    );

  return (
    <div className="space-y-6">
      <p className="text-xs text-ink-400">
        Share the collection link: <span className="font-mono text-ink-600">heyrhai.com/testimonial</span>. Toggle a
        voice on to feature it on the homepage; drag the shown ones into the order you want.
      </p>

      <section>
        <p className="eyebrow mb-2">On the site · {shown.length}</p>
        {shown.length === 0 ? (
          <p className="text-[12px] text-ink-400">None featured yet — turn one on below.</p>
        ) : (
          <div className="space-y-2">
            {shown.map((t, i) => (
              <Row
                key={t.id}
                t={t}
                displayed
                canUp={i > 0}
                canDown={i < shown.length - 1}
                onMove={dir => move(t.id, dir)}
                onToggle={() => setDisplayed(t.id, false)}
                onDelete={() => remove(t.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="eyebrow mb-2">Not shown · {hidden.length}</p>
        {hidden.length === 0 ? (
          <p className="text-[12px] text-ink-400">Nothing waiting.</p>
        ) : (
          <div className="space-y-2">
            {hidden.map(t => (
              <Row key={t.id} t={t} displayed={false} onToggle={() => setDisplayed(t.id, true)} onDelete={() => remove(t.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Row({
  t,
  displayed,
  canUp,
  canDown,
  onMove,
  onToggle,
  onDelete
}: {
  t: Testimonial;
  displayed: boolean;
  canUp?: boolean;
  canDown?: boolean;
  onMove?: (dir: -1 | 1) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-900">
            {t.name}
            {t.role && <span className="ml-1.5 font-normal text-ink-500">· {t.role}</span>}
          </p>
          <p className="text-[10px] text-ink-400">
            {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            {t.durationSec ? ` · ${t.durationSec}s` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {displayed && onMove && (
            <>
              <button type="button" onClick={() => onMove(-1)} disabled={!canUp} className="rounded px-1.5 text-ink-400 hover:text-ink-800 disabled:opacity-30" title="Move up">▲</button>
              <button type="button" onClick={() => onMove(1)} disabled={!canDown} className="rounded px-1.5 text-ink-400 hover:text-ink-800 disabled:opacity-30" title="Move down">▼</button>
            </>
          )}
          <button
            type="button"
            onClick={onToggle}
            className={`rounded-md px-3 py-1 text-xs font-medium ${displayed ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}
          >
            {displayed ? '● On site' : '○ Show'}
          </button>
          <button type="button" onClick={onDelete} className="rounded px-1.5 text-xs text-ink-300 hover:text-rose-600" title="Delete">✕</button>
        </div>
      </div>
      <audio src={t.audioUrl} controls preload="none" className="mt-3 w-full" />
      {t.transcript && (
        <p className="mt-2 rounded-md bg-cream-50 px-3 py-2 text-[13px] italic leading-relaxed text-ink-600">
          &ldquo;{t.transcript}&rdquo;
        </p>
      )}
    </div>
  );
}
