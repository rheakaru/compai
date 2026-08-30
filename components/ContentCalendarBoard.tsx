'use client';

// The team content calendar at /admin/content-calendar. Drag pieces of content
// from the bank onto dates (or between dates), mark them posted, write captions,
// and assign who's giving the idea vs who's posting. Team-gated; autosaves.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthedFetch } from './useAuthedFetch';

type ContentType = 'post' | 'reel' | 'story' | 'testimonial';
type ContentStatus = 'planned' | 'posted';
interface Item {
  id: string;
  title: string;
  type: ContentType;
  date: string | null;
  status: ContentStatus;
  caption: string;
  owner: string;
  poster: string;
  notes: string;
}

const OWNERS = ['Shriya', 'Rhea', 'Yeshoda'];
const POSTERS = ['Disha', 'Shriya'];
const TYPE_META: Record<ContentType, { label: string; chip: string }> = {
  post: { label: 'Post', chip: 'bg-accent-50 text-accent border-accent/30' },
  reel: { label: 'Reel', chip: 'bg-blue-50 text-blue-700 border-blue-200' },
  story: { label: 'Story', chip: 'bg-ink-100 text-ink-600 border-ink-200' },
  testimonial: { label: 'Testimonial', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function ContentCalendarBoard() {
  const authedFetch = useAuthedFetch();
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [view, setView] = useState<{ y: number; m: number }>({ y: 2026, m: 7 }); // Aug 2026
  const [saved, setSaved] = useState<'idle' | 'saving' | 'ok'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    authedFetch('/api/admin/content-calendar')
      .then(async r => {
        if (r.status === 401 || r.status === 403) {
          setErr('Sign in with your @heyrhai.com account to open the calendar.');
          return;
        }
        const d = (await r.json()) as { items: Item[] };
        setItems(d.items);
      })
      .catch(() => setErr('Could not load the calendar.'));
  }, [authedFetch]);

  // Autosave, debounced.
  const persist = useCallback(
    (next: Item[]) => {
      setSaved('saving');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await authedFetch('/api/admin/content-calendar', { method: 'PUT', body: JSON.stringify({ items: next }) });
          setSaved('ok');
          setTimeout(() => setSaved('idle'), 1500);
        } catch {
          setSaved('idle');
        }
      }, 700);
    },
    [authedFetch]
  );

  const update = useCallback(
    (fn: (prev: Item[]) => Item[]) => {
      setItems(prev => {
        if (!prev) return prev;
        const next = fn(prev);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const setDate = (id: string, date: string | null) =>
    update(prev => prev.map(i => (i.id === id ? { ...i, date } : i)));
  const patch = (id: string, p: Partial<Item>) => update(prev => prev.map(i => (i.id === id ? { ...i, ...p } : i)));
  const remove = (id: string) => update(prev => prev.filter(i => i.id !== id));
  const addNew = () =>
    update(prev => [
      { id: `new-${Date.now()}`, title: 'New content', type: 'post', date: null, status: 'planned', caption: '', owner: '', poster: '', notes: '' },
      ...prev
    ]);

  const onDrop = (e: React.DragEvent, date: string | null) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) setDate(id, date);
  };

  const weeks = useMemo(() => buildWeeks(view.y, view.m), [view]);

  if (err) return <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-ink-600">{err}</main>;
  if (!items) return <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-ink-500">Loading…</main>;

  const bank = items.filter(i => !i.date);
  const editItem = items.find(i => i.id === editing) || null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Social</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-ink-900">Content calendar</h1>
          <p className="mt-1 text-sm text-ink-500">
            Drag from the bank onto a date, or between dates. Click a piece to edit its caption, mark it posted, and set
            who&apos;s giving the idea and who&apos;s posting.
          </p>
        </div>
        <span className="text-xs text-ink-400">
          {saved === 'saving' ? 'Saving…' : saved === 'ok' ? 'Saved ✓' : ''}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Calendar */}
        <div>
          <div className="mb-3 flex items-center gap-3">
            <button type="button" onClick={() => setView(shift(view, -1))} className="rounded-md border border-ink-200 px-2.5 py-1 text-sm hover:bg-white">←</button>
            <span className="font-display text-lg text-ink-900">
              {MONTHS[view.m]} {view.y}
            </span>
            <button type="button" onClick={() => setView(shift(view, 1))} className="rounded-md border border-ink-200 px-2.5 py-1 text-sm hover:bg-white">→</button>
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-ink-200 bg-ink-200 text-xs">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="bg-cream-50 px-2 py-1.5 text-center font-medium text-ink-500">{d}</div>
            ))}
            {weeks.flat().map((cell, i) => {
              const cellItems = cell ? items.filter(it => it.date === cell) : [];
              return (
                <div
                  key={i}
                  onDragOver={cell ? e => e.preventDefault() : undefined}
                  onDrop={cell ? e => onDrop(e, cell) : undefined}
                  className={`min-h-[92px] bg-white p-1.5 ${cell ? '' : 'bg-cream-50/40'}`}
                >
                  {cell && <div className="mb-1 text-[10px] text-ink-400">{Number(cell.slice(-2))}</div>}
                  <div className="space-y-1">
                    {cellItems.map(it => (
                      <Chip key={it.id} item={it} onClick={() => setEditing(it.id)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bank */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => onDrop(e, null)}
          className="h-fit rounded-xl border border-ink-200 bg-white p-4"
        >
          <div className="flex items-center justify-between">
            <p className="font-medium text-ink-900">Content bank</p>
            <button type="button" onClick={addNew} className="text-xs text-accent hover:underline">+ add</button>
          </div>
          <p className="mt-1 text-[11px] text-ink-500">Ready content, not yet scheduled. Drag onto a date.</p>
          <div className="mt-3 space-y-1.5">
            {bank.length === 0 && <p className="text-xs text-ink-400">Everything&apos;s scheduled. Nice.</p>}
            {bank.map(it => (
              <Chip key={it.id} item={it} onClick={() => setEditing(it.id)} />
            ))}
          </div>
        </div>
      </div>

      {editItem && (
        <Editor
          item={editItem}
          onClose={() => setEditing(null)}
          onPatch={p => patch(editItem.id, p)}
          onRemove={() => {
            remove(editItem.id);
            setEditing(null);
          }}
          onUnschedule={() => setDate(editItem.id, null)}
        />
      )}
    </main>
  );
}

function Chip({ item, onClick }: { item: Item; onClick: () => void }) {
  const meta = TYPE_META[item.type];
  return (
    <button
      type="button"
      draggable
      onDragStart={e => e.dataTransfer.setData('text/plain', item.id)}
      onClick={onClick}
      className={`block w-full cursor-grab rounded-md border px-2 py-1 text-left text-[11px] leading-tight active:cursor-grabbing ${meta.chip} ${
        item.status === 'posted' ? 'opacity-60' : ''
      }`}
      title={item.title}
    >
      <span className="flex items-center gap-1">
        {item.status === 'posted' && <span>✓</span>}
        <span className="truncate">{item.title}</span>
      </span>
      {(item.owner || item.poster) && (
        <span className="mt-0.5 block truncate text-[9px] opacity-70">
          {item.owner && `idea: ${item.owner}`} {item.poster && `· posts: ${item.poster}`}
        </span>
      )}
    </button>
  );
}

function Editor({
  item,
  onClose,
  onPatch,
  onRemove,
  onUnschedule
}: {
  item: Item;
  onClose: () => void;
  onPatch: (p: Partial<Item>) => void;
  onRemove: () => void;
  onUnschedule: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/20" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-cream p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <input
            value={item.title}
            onChange={e => onPatch({ title: e.target.value })}
            className="w-full rounded-md border border-ink-200 bg-white px-2.5 py-1.5 font-display text-lg text-ink-900"
          />
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-700">✕</button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <label className="block text-ink-500">
            Type
            <select
              value={item.type}
              onChange={e => onPatch({ type: e.target.value as ContentType })}
              className="mt-1 w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-900"
            >
              <option value="post">Post</option>
              <option value="reel">Reel</option>
              <option value="story">Story</option>
              <option value="testimonial">Testimonial</option>
            </select>
          </label>
          <label className="block text-ink-500">
            Date
            <input
              type="date"
              value={item.date ?? ''}
              onChange={e => onPatch({ date: e.target.value || null })}
              className="mt-1 w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-900"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => onPatch({ status: item.status === 'posted' ? 'planned' : 'posted' })}
          className={`mt-4 w-full rounded-md px-3 py-2 text-sm font-medium ${
            item.status === 'posted' ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-900 text-cream hover:bg-ink-800'
          }`}
        >
          {item.status === 'posted' ? '✓ Posted — mark as not posted' : 'Mark as posted'}
        </button>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <label className="block text-ink-500">
            Idea from
            <select value={item.owner} onChange={e => onPatch({ owner: e.target.value })} className="mt-1 w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-900">
              <option value="">—</option>
              {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label className="block text-ink-500">
            Posted by
            <select value={item.poster} onChange={e => onPatch({ poster: e.target.value })} className="mt-1 w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-900">
              <option value="">—</option>
              {POSTERS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        </div>

        <label className="mt-4 block text-xs text-ink-500">
          Caption
          <textarea
            value={item.caption}
            onChange={e => onPatch({ caption: e.target.value })}
            rows={6}
            placeholder="Write the caption here so Disha and Shriya are working from the same words."
            className="mt-1 w-full rounded-md border border-ink-200 bg-white px-2.5 py-2 text-sm leading-relaxed text-ink-800"
          />
        </label>

        <label className="mt-3 block text-xs text-ink-500">
          Notes
          <textarea
            value={item.notes}
            onChange={e => onPatch({ notes: e.target.value })}
            rows={2}
            className="mt-1 w-full rounded-md border border-ink-200 bg-white px-2.5 py-2 text-sm text-ink-700"
          />
        </label>

        <div className="mt-5 flex items-center justify-between">
          <button type="button" onClick={onUnschedule} className="text-xs text-ink-500 hover:text-ink-800">
            ↩ Move to bank
          </button>
          <button type="button" onClick={onRemove} className="text-xs text-rose-500 hover:text-rose-700">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// Build a month grid: array of weeks, each 7 cells (ISO date string or null).
function buildWeeks(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(iso(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function shift(v: { y: number; m: number }, by: number): { y: number; m: number } {
  const d = new Date(v.y, v.m + by, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}
