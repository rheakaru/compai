'use client';

// Team learning resources at /admin/resources — the house writing standards,
// the sales playbook, and the sales motion. Team-gated (fetches an operator
// API). A left rail lists the docs; the selected one renders full-width.

import { useCallback, useEffect, useState } from 'react';
import { useAuthedFetch } from './useAuthedFetch';
import { EDITORIAL_PROSE_CLASS } from '@/lib/markdown';

interface Rendered {
  slug: string;
  title: string;
  dek: string;
  audience: string;
  readingMinutes: number;
  html: string;
}

export function ResourcesLibrary() {
  const authedFetch = useAuthedFetch();
  const [items, setItems] = useState<Rendered[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authedFetch('/api/admin/resources');
      if (res.status === 401 || res.status === 403) {
        setErr('Sign in with your @heyrhai.com account to read these.');
        return;
      }
      const d = (await res.json()) as { resources: Rendered[] };
      setItems(d.resources);
      setActive(d.resources[0]?.slug ?? null);
    } catch {
      setErr('Could not load resources.');
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-ink-600">{err}</main>;
  if (!items) return <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-ink-500">Loading…</main>;

  const current = items.find(r => r.slug === active) ?? items[0];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <p className="eyebrow">For the team</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight text-ink-900">Learning resources</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">
        How we write, how we pitch, and how the whole sales motion fits together. Read these before you write to a
        client or take a call.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <nav className="lg:sticky lg:top-20 lg:self-start">
          <ul className="space-y-2">
            {items.map(r => (
              <li key={r.slug}>
                <button
                  type="button"
                  onClick={() => setActive(r.slug)}
                  className={`w-full rounded-xl border p-3 text-left ${
                    current.slug === r.slug ? 'border-accent bg-white' : 'border-ink-200 bg-white/60 hover:bg-white'
                  }`}
                >
                  <p className="text-sm font-medium text-ink-900">{r.title}</p>
                  <p className="mt-1 text-[11px] text-ink-500">
                    {r.audience} · {r.readingMinutes} min
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 rounded-2xl border border-ink-200 bg-white p-6 sm:p-9">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">{current.audience}</p>
          <div className={`mt-3 ${EDITORIAL_PROSE_CLASS}`} dangerouslySetInnerHTML={{ __html: current.html }} />
        </article>
      </div>
    </main>
  );
}
