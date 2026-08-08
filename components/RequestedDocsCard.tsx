'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthedFetch } from './useAuthedFetch';

// "Docs people asked for" — demand tracker on the Docs page. Log every time a
// client asks for collateral that doesn't exist yet (a Rhai one-pager, a
// pricing sheet). Repeat asks increment the count; popular ones get flagged
// as candidates to draft once and send proactively.

interface DocRequest {
  id: string;
  title: string;
  count: number;
  requestedBy: string[];
  status: 'idea' | 'drafted' | 'ready';
  note?: string;
  docLink?: string;
}

const STATUS_META: Record<DocRequest['status'], { label: string; chip: string; next: DocRequest['status'] }> = {
  idea: { label: 'Idea', chip: 'bg-ink-50 text-ink-600 border-ink-200', next: 'drafted' },
  drafted: { label: 'Drafted', chip: 'bg-amber-50 text-amber-800 border-amber-200', next: 'ready' },
  ready: { label: 'Ready to send', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', next: 'idea' }
};

const HOT_THRESHOLD = 3;

export function RequestedDocsCard() {
  const api = useAuthedFetch();
  const [requests, setRequests] = useState<DocRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', requestedBy: '' });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api('/api/rhai/doc-requests');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRequests(((await res.json()) as { requests: DocRequest[] }).requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      const res = await api('/api/rhai/doc-requests', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          ...(form.requestedBy.trim() ? { requestedBy: form.requestedBy.trim() } : {})
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setForm({ title: '', requestedBy: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function bump(r: DocRequest) {
    const who = window.prompt('Who asked this time? (optional)') ?? '';
    await api('/api/rhai/doc-requests', {
      method: 'POST',
      body: JSON.stringify({ title: r.title, ...(who.trim() ? { requestedBy: who.trim() } : {}) })
    });
    await load();
  }

  async function advance(r: DocRequest) {
    await api('/api/rhai/doc-requests', {
      method: 'PATCH',
      body: JSON.stringify({ id: r.id, status: STATUS_META[r.status].next })
    });
    await load();
  }

  return (
    <div className="mb-4 rounded-md border border-ink-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <p className="text-sm font-medium text-ink-900">
          Docs people asked for
          {requests && requests.length > 0 && (
            <span className="ml-2 text-xs font-normal text-ink-400">
              {requests.length} tracked · {requests.filter(r => r.count >= HOT_THRESHOLD && r.status !== 'ready').length} worth drafting
            </span>
          )}
        </p>
        <span className="text-ink-400">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="border-t border-ink-100 px-4 py-3">
          <p className="mb-2 text-xs text-ink-500">
            Every time a client asks for collateral that doesn&apos;t exist yet (&ldquo;do you have a
            one-pager on Rhai?&rdquo;), log it. Once {HOT_THRESHOLD}+ people want the same thing,
            draft it once and start sending it proactively.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              className="min-w-[220px] flex-1 rounded-md border border-ink-200 px-2 py-1.5 text-sm"
              placeholder="What did they ask for? e.g. One-pager on Rhai"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && add()}
            />
            <input
              className="w-44 rounded-md border border-ink-200 px-2 py-1.5 text-sm"
              placeholder="Who asked (optional)"
              value={form.requestedBy}
              onChange={e => setForm(f => ({ ...f, requestedBy: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && add()}
            />
            <button
              type="button"
              disabled={busy}
              onClick={add}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
            >
              Log ask
            </button>
          </div>

          {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}

          {requests === null ? (
            <p className="text-xs text-ink-400">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="text-xs text-ink-400">Nothing logged yet.</p>
          ) : (
            <div className="space-y-1">
              {requests.map(r => {
                const meta = STATUS_META[r.status];
                const hot = r.count >= HOT_THRESHOLD && r.status !== 'ready';
                return (
                  <div
                    key={r.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 ${
                      hot ? 'border-amber-300 bg-amber-50/60' : 'border-ink-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-ink-900">
                        <span className="font-medium">{r.title}</span>
                        <span className="ml-2 rounded-full bg-ink-900 px-1.5 py-px text-[10px] font-semibold text-white">
                          ×{r.count}
                        </span>
                        {hot && (
                          <span className="ml-2 text-[11px] font-medium text-amber-800">
                            — popular, worth drafting
                          </span>
                        )}
                      </p>
                      {(r.requestedBy.length > 0 || r.docLink) && (
                        <p className="truncate text-[11px] text-ink-500">
                          {r.requestedBy.length > 0 ? `Asked by ${r.requestedBy.slice(-5).join(', ')}` : ''}
                          {r.docLink ? (
                            <>
                              {r.requestedBy.length > 0 ? ' · ' : ''}
                              <a href={r.docLink} target="_blank" rel="noreferrer" className="text-indigo-600 underline">
                                doc
                              </a>
                            </>
                          ) : null}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => bump(r)}
                        title="Someone else asked for this"
                        className="rounded-md border border-ink-200 px-2 py-0.5 text-[11px] text-ink-600 hover:bg-ink-50"
                      >
                        +1 ask
                      </button>
                      <button
                        type="button"
                        onClick={() => advance(r)}
                        title="Advance status"
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${meta.chip}`}
                      >
                        {meta.label} →
                      </button>
                      {r.status !== 'idea' && !r.docLink && (
                        <button
                          type="button"
                          onClick={async () => {
                            const link = window.prompt('Link to the finished doc:');
                            if (!link?.trim()) return;
                            await api('/api/rhai/doc-requests', {
                              method: 'PATCH',
                              body: JSON.stringify({ id: r.id, docLink: link.trim() })
                            });
                            await load();
                          }}
                          className="rounded-md border border-ink-200 px-2 py-0.5 text-[11px] text-ink-600 hover:bg-ink-50"
                        >
                          + link
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
