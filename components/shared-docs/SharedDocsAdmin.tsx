'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../AuthProvider';
import { useAuthedFetch } from '../useAuthedFetch';

// Operator view: every shared doc, who opened it, when, how far they read and
// for how long. One row per reader (latest first), expandable to every open.

interface View {
  id: string;
  email: string;
  startedAt: number;
  lastSeenAt: number;
  maxDepth: number;
  maxSectionIndex: number;
  maxSection: string;
  totalSections: number;
  activeSeconds: number;
  userAgent: string;
  referrer: string;
  country: string;
}
interface GateVisit {
  at: number;
  referrer: string;
  userAgent: string;
  country: string;
}
interface Doc {
  slug: string;
  title: string;
  description: string;
  views: View[];
  gateVisits: GateVisit[];
}

const source = (r: string) => (r ? r.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '') : 'direct link');

const when = (t: number) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(t);
const dur = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60 ? `${s % 60}s` : ''}`.trim());
const device = (ua: string) => (/iPhone|Android.*Mobile/i.test(ua) ? 'Phone' : /iPad|Tablet/i.test(ua) ? 'Tablet' : ua ? 'Desktop' : '—');

export function SharedDocsAdmin() {
  const { user, signIn } = useAuth();
  const authedFetch = useAuthedFetch();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authedFetch('/api/rhai/shared-docs').catch(() => null);
    if (!res?.ok) {
      setError(res?.status === 401 || res?.status === 403 ? 'Sign in with your operator account.' : 'Could not load.');
      return;
    }
    setDocs(((await res.json()) as { docs: Doc[] }).docs);
    setError(null);
  }, [authedFetch]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16">
        <button type="button" onClick={() => signIn().catch(() => undefined)} className="rounded-md bg-ink-900 px-4 py-2 text-sm text-cream">
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Shared docs</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-ink-900">Who&apos;s reading</h1>
          <p className="mt-1 text-sm text-ink-600">
            Unlisted pages behind an email gate. Every open is logged with how far the reader got.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-md border border-ink-300 bg-white px-3 py-1.5 text-xs text-ink-700 hover:bg-cream-50">
          Refresh
        </button>
      </div>
      {error && <p className="mt-6 text-sm text-rose-500">{error}</p>}
      {!docs && !error && <p className="mt-6 text-sm text-ink-400">Loading…</p>}

      {docs?.map(doc => {
        const url = `https://heyrhai.com/p/${doc.slug}`;
        const byReader = new Map<string, View[]>();
        for (const v of doc.views) byReader.set(v.email, [...(byReader.get(v.email) ?? []), v]);
        const readers = [...byReader.entries()].map(([email, vs]) => ({
          email,
          vs,
          last: vs[0],
          opens: vs.length,
          depth: Math.max(...vs.map(v => v.maxDepth)),
          best: vs.reduce((a, b) => (b.maxSectionIndex > a.maxSectionIndex ? b : a)),
          time: vs.reduce((n, v) => n + v.activeSeconds, 0)
        }));
        const finished = readers.filter(r => r.depth >= 90).length;
        const sources = new Map<string, number>();
        for (const g of doc.gateVisits) sources.set(source(g.referrer), (sources.get(source(g.referrer)) ?? 0) + 1);
        return (
          <section key={doc.slug} className="mt-8 rounded-xl border border-ink-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 p-5">
              <div>
                <h2 className="font-display text-xl text-ink-900">{doc.title}</h2>
                <p className="mt-1 font-mono text-xs text-ink-500">{url}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(url);
                    setCopied(doc.slug);
                    setTimeout(() => setCopied(null), 1500);
                  }}
                  className="rounded-md border border-ink-300 px-3 py-1.5 text-xs text-ink-700 hover:bg-cream-50"
                >
                  {copied === doc.slug ? 'Copied' : 'Copy link'}
                </button>
                <a href={`/p/${doc.slug}`} target="_blank" rel="noreferrer" className="rounded-md border border-ink-300 px-3 py-1.5 text-xs text-ink-700 hover:bg-cream-50">
                  Open ↗
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-b border-ink-200 p-5 sm:grid-cols-5">
              <Stat n={doc.gateVisits.length} label="Landed on the gate" />
              <Stat n={doc.views.length} label="Opens" />
              <Stat n={readers.length} label="Readers" />
              <Stat n={finished} label="Read to the end" />
              <Stat n={readers.length ? `${Math.round(readers.reduce((a, r) => a + r.depth, 0) / readers.length)}%` : '—'} label="Avg. furthest point" />
            </div>
            {doc.gateVisits.length > 0 && (
              <p className="border-b border-ink-200 px-5 py-3 text-xs text-ink-500">
                Gate visits by source:{' '}
                {[...sources.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, n]) => `${k} ${n}`)
                  .join(' · ')}
                . Gate visits are anonymous and only counted from when this was added; link previews aren&apos;t counted.
              </p>
            )}
            {readers.length === 0 ? (
              <p className="p-5 text-sm text-ink-400">No one has opened it yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-ink-400">
                    <tr>
                      <th className="px-5 py-2 font-medium">Reader</th>
                      <th className="px-3 py-2 font-medium">Last opened</th>
                      <th className="px-3 py-2 font-medium">Opens</th>
                      <th className="px-3 py-2 font-medium">Read to</th>
                      <th className="px-3 py-2 font-medium">Time reading</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readers.map(r => {
                      const key = `${doc.slug}:${r.email}`;
                      return (
                        <Fragment key={key}>
                          <tr onClick={() => setOpen(open === key ? null : key)} className="cursor-pointer border-t border-ink-100 hover:bg-cream-50">
                            <td className="px-5 py-3 text-ink-900">{r.email}</td>
                            <td className="px-3 py-3 text-ink-600">{when(r.last.startedAt)}</td>
                            <td className="px-3 py-3 text-ink-600">{r.opens}</td>
                            <td className="px-3 py-3">
                              <Depth pct={r.depth} label={r.best.maxSection} />
                            </td>
                            <td className="px-3 py-3 text-ink-600">{dur(r.time)}</td>
                          </tr>
                          {open === key &&
                            r.vs.map(v => (
                              <tr key={v.id} className="bg-cream-50 text-xs text-ink-600">
                                <td className="px-5 py-2 pl-9">
                                  {device(v.userAgent)}
                                  {v.country ? ` · ${v.country}` : ''}
                                  {v.referrer ? ` · from ${v.referrer.replace(/^https?:\/\//, '').slice(0, 40)}` : ''}
                                </td>
                                <td className="px-3 py-2">{when(v.startedAt)}</td>
                                <td className="px-3 py-2" />
                                <td className="px-3 py-2">
                                  {v.maxDepth}% · {v.maxSection || '—'}
                                </td>
                                <td className="px-3 py-2">{dur(v.activeSeconds)}</td>
                              </tr>
                            ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl text-ink-900">{n}</p>
      <p className="text-[11px] text-ink-500">{label}</p>
    </div>
  );
}

function Depth({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="min-w-[140px]">
      <div className="h-1.5 w-full rounded-full bg-ink-100">
        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-ink-500">
        {pct}%{label ? ` · ${label}` : ''}
      </p>
    </div>
  );
}
