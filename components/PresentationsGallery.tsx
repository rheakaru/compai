'use client';

// The presentations gallery at /admin/presentations. Every workshop and
// community deck we've run, grouped by client and by community, each with its
// slide-by-slide flow index and a viewer (HTML decks open in an iframe, PDFs in
// the browser viewer). A rich, reusable record of exactly how we teach and pitch.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthedFetch } from './useAuthedFetch';

interface Slide { n: number; label: string }
interface Deck {
  id: string;
  title: string;
  client: string;
  clientLeadId?: string;
  category: 'client' | 'community';
  dateLabel: string;
  format: 'html' | 'pdf';
  slideCount: number;
  index: Slide[];
}

export function PresentationsGallery() {
  const authedFetch = useAuthedFetch();
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Deck | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authedFetch('/api/rhai/presentations');
      if (res.status === 401 || res.status === 403) {
        setErr('Sign in with your @heyrhai.com account to view our decks.');
        return;
      }
      const d = (await res.json()) as { presentations: Deck[] };
      setDecks(d.presentations);
    } catch {
      setErr('Could not load presentations.');
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    if (!decks) return [];
    const byClient = new Map<string, Deck[]>();
    for (const d of decks) {
      const key = d.category === 'community' ? 'Hang w AI — community' : d.client;
      (byClient.get(key) ?? byClient.set(key, []).get(key)!).push(d);
    }
    // Clients first (alpha), community group last.
    return [...byClient.entries()].sort((a, b) => {
      const ac = a[1][0].category === 'community' ? 1 : 0;
      const bc = b[1][0].category === 'community' ? 1 : 0;
      return ac - bc || a[0].localeCompare(b[0]);
    });
  }, [decks]);

  if (err) return <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-ink-600">{err}</main>;
  if (!decks) return <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-ink-500">Loading…</main>;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <p className="eyebrow">The archive</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight text-ink-900">Presentations</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">
        Every workshop and community deck we&apos;ve run — grouped by client, then the Hang w AI community sessions.
        Open one to view it, or scan its flow index to find and reuse the good parts. {decks.length} decks.
      </p>

      {groups.map(([label, list]) => (
        <section key={label} className="mt-10">
          <h2 className="font-display text-xl text-ink-900">{label}</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {list.map(d => (
              <DeckCard key={d.id} deck={d} onOpen={() => setViewing(d)} />
            ))}
          </div>
        </section>
      ))}

      {viewing && <Viewer deck={viewing} onClose={() => setViewing(null)} />}
    </main>
  );
}

function DeckCard({ deck, onOpen }: { deck: Deck; onOpen: () => void }) {
  const [showIndex, setShowIndex] = useState(false);
  return (
    <article className="rounded-2xl border border-ink-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink-900">{deck.title}</p>
          <p className="mt-0.5 text-xs text-ink-500">
            {deck.dateLabel ? `${deck.dateLabel} · ` : ''}
            {deck.slideCount} slides · {deck.format.toUpperCase()}
          </p>
        </div>
        <button type="button" onClick={onOpen} className="shrink-0 rounded-md bg-ink-900 px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink-800">
          Open ↗
        </button>
      </div>

      {deck.index.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setShowIndex(v => !v)}
            className="mt-3 text-xs text-accent hover:underline"
          >
            {showIndex ? 'Hide' : 'Show'} flow index ({deck.index.length})
          </button>
          {showIndex && (
            <ol className="mt-2 max-h-72 space-y-0.5 overflow-y-auto border-t border-ink-100 pt-2 text-[11px] leading-relaxed text-ink-600">
              {deck.index.map(s => (
                <li key={s.n} className="flex gap-2">
                  <span className="w-6 shrink-0 text-right font-mono text-ink-300">{s.n}</span>
                  <span className="truncate">{s.label}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <p className="mt-3 text-[11px] text-ink-400">Image slides — no text index. Open to view.</p>
      )}
    </article>
  );
}

function Viewer({ deck, onClose }: { deck: Deck; onClose: () => void }) {
  const src = `/api/rhai/presentations/file?id=${encodeURIComponent(deck.id)}`;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-900/80" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-2 text-cream" onClick={e => e.stopPropagation()}>
        <span className="text-sm font-medium">
          {deck.client} · {deck.title}
        </span>
        <span className="flex items-center gap-3">
          <a href={src} target="_blank" rel="noreferrer" className="text-xs underline">Open in new tab</a>
          <button type="button" onClick={onClose} className="text-lg">✕</button>
        </span>
      </div>
      <iframe
        src={src}
        title={deck.title}
        className="min-h-0 flex-1 bg-white"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}
