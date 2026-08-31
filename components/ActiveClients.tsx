'use client';

// A guided walkthrough of our current active clients, at /admin/active-clients.
// Team-gated. Meant for someone getting up to speed (the intern, with Yeshoda)
// — just the clients we're actually working with, not the whole leads list,
// each with where they stand, recent calls and documents, and a link to the
// full lead page for the detail.

import { useCallback, useEffect, useState } from 'react';
import { useAuthedFetch } from './useAuthedFetch';

interface Client {
  id: string;
  company: string;
  person: string;
  stage: string;
  value: number;
  nextSteps: string;
  smartNotes: string;
  calls: { title: string; dateLabel: string }[];
  docs: { name: string; kind: string; dateLabel: string }[];
  decks: { id: string; title: string; slideCount: number; format: string }[];
}

const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

export function ActiveClients() {
  const authedFetch = useAuthedFetch();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authedFetch('/api/admin/active-clients');
      if (res.status === 401 || res.status === 403) {
        setErr('Sign in with your @heyrhai.com account to view our clients.');
        return;
      }
      const d = (await res.json()) as { clients: Client[] };
      setClients(d.clients);
    } catch {
      setErr('Could not load clients.');
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-ink-600">{err}</main>;
  if (!clients) return <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-ink-500">Loading…</main>;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <p className="eyebrow">Get up to speed</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight text-ink-900">Our active clients</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">
        The companies we&apos;re working with right now — where each stands, their recent calls and documents, and a
        link to the full page. Read through these before you start on the pipeline. {clients.length} active.
      </p>

      <div className="mt-8 space-y-5">
        {clients.map(c => (
          <article key={c.id} className="rounded-2xl border border-ink-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl text-ink-900">{c.company}</h2>
                <p className="mt-0.5 text-sm text-ink-500">{c.person}</p>
              </div>
              <div className="text-right">
                <span className="inline-block rounded-full border border-accent/30 bg-accent-50 px-2.5 py-0.5 text-[11px] font-medium text-accent">
                  {c.stage}
                </span>
                {c.value > 0 && <p className="mt-1 text-xs text-ink-500">{inr(c.value)}</p>}
              </div>
            </div>

            {c.smartNotes && (
              <p className="mt-3 rounded-lg bg-cream-50 p-3 text-sm leading-relaxed text-ink-700">{c.smartNotes}</p>
            )}
            {c.nextSteps && (
              <p className="mt-3 text-sm text-ink-700">
                <span className="font-medium text-ink-900">Next:</span> {c.nextSteps}
              </p>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Recent calls</p>
                {c.calls.length ? (
                  <ul className="mt-1.5 space-y-1">
                    {c.calls.map((call, i) => (
                      <li key={i} className="text-sm text-ink-700">
                        {call.title} <span className="text-ink-400">· {call.dateLabel}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-sm text-ink-400">None recorded.</p>
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Recent documents</p>
                {c.docs.length ? (
                  <ul className="mt-1.5 space-y-1">
                    {c.docs.map((doc, i) => (
                      <li key={i} className="text-sm text-ink-700">
                        {doc.name} <span className="text-ink-400">· {doc.dateLabel}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-sm text-ink-400">None yet.</p>
                )}
              </div>
            </div>

            {c.decks.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Our decks for them</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {c.decks.map(d => (
                    <a
                      key={d.id}
                      href={`/api/rhai/presentations/file?id=${encodeURIComponent(d.id)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-ink-200 bg-cream-50 px-2.5 py-1 text-xs text-ink-700 hover:bg-white"
                    >
                      {d.title} <span className="text-ink-400">· {d.slideCount} slides</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-4">
              <a href={`/leads/${c.id}`} className="text-sm text-accent underline-offset-4 hover:underline">
                Open the full client page →
              </a>
              <a href="/admin/presentations" className="text-sm text-ink-500 underline-offset-4 hover:underline">
                All presentations →
              </a>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
