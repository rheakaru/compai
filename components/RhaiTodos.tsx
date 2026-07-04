'use client';

// Quick to-dos — one dump box for everything. The server links each to-do to
// a lead by name; ambiguous matches come back as chips to pick from.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuthedFetch } from './useAuthedFetch';
import type { RhaiTodo } from '@/lib/rhai/types';

export function TodosSection() {
  const authedFetch = useAuthedFetch();
  const [todos, setTodos] = useState<RhaiTodo[] | null>(null);
  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    const res = await authedFetch('/api/rhai/todos');
    if (res.ok) setTodos(((await res.json()) as { todos: RhaiTodo[] }).todos);
  }, [authedFetch]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const res = await authedFetch('/api/rhai/todos', { method: 'POST', body: JSON.stringify({ text }) });
    if (res.ok) {
      const { todo } = (await res.json()) as { todo: RhaiTodo };
      setTodos(prev => [todo, ...(prev ?? [])]);
    }
  };

  const remove = async (id: string) => {
    setTodos(prev => (prev ? prev.filter(x => x.id !== id) : prev));
    await authedFetch('/api/rhai/todos', { method: 'PATCH', body: JSON.stringify({ id, delete: true }) }).catch(
      () => undefined
    );
  };

  const patch = async (id: string, p: Record<string, unknown>) => {
    setTodos(prev => (prev ? prev.map(t => (t.id === id ? ({ ...t, ...p } as RhaiTodo) : t)) : prev));
    await authedFetch('/api/rhai/todos', { method: 'PATCH', body: JSON.stringify({ id, ...p }) }).catch(() => undefined);
    if ('leadId' in p) load().catch(() => undefined);
  };

  const visible = (todos ?? []).filter(t => showDone || !t.done);

  return (
    <section className="mb-6 rounded-lg border border-ink-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="eyebrow">Quick to-dos</p>
        <button type="button" onClick={() => setShowDone(v => !v)} className="text-[11px] text-ink-400 hover:underline">
          {showDone ? 'Hide done' : 'Show done'}
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder='Dump it — "follow up with Mitali on the proposal Monday" — Rhai links it to the right lead.'
          className="flex-1 rounded-md border border-ink-200 px-3 py-2 text-xs focus:border-ink-300 focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="rounded-md bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-600 disabled:opacity-50"
        >
          + Add
        </button>
      </div>

      {visible.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {visible.map(t => (
            <li key={t.id} className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={t.done}
                onChange={e => patch(t.id, { done: e.target.checked })}
                className="mt-0.5 h-3.5 w-3.5 rounded border-ink-300"
              />
              <span className={`flex-1 ${t.done ? 'text-ink-300 line-through' : 'text-ink-800'}`}>
                {t.text}
                {t.leadId && t.leadLabel && (
                  <Link href={`/leads/${t.leadId}`} className="ml-2 text-[10px] text-indigo-600 hover:underline">
                    → {t.leadLabel}
                  </Link>
                )}
                {t.candidates && t.candidates.length > 0 && (
                  <span className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-amber-700">who&apos;s this for?</span>
                    {t.candidates.map(c => (
                      <button
                        key={c.leadId}
                        type="button"
                        onClick={() => patch(t.id, { leadId: c.leadId, leadLabel: c.label })}
                        className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800 hover:bg-amber-100"
                      >
                        {c.label}
                      </button>
                    ))}
                  </span>
                )}
              </span>
              <button type="button" onClick={() => remove(t.id)} className="text-ink-300 hover:text-rose-600">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
