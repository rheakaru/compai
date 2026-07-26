'use client';

// Interviews tab — the Rhai-interviewer overview. Top level shows the JOBS
// (open roles): each role's invite slug with its open/closed state, application
// + completed counts, verdict tallies, and created date. Individual candidate
// sessions never render here — clicking a job opens its dedicated page at
// /interviews/<jobId>.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuthedFetch } from './useAuthedFetch';
import type { InterviewConfig, InterviewSession } from '@/lib/rhai/types';

interface JobCounts {
  total: number;
  inProgress: number;
  completed: number;
  strong: number;
  possible: number;
  notFit: number;
  latestAt?: number;
}

function countSessions(sessions: InterviewSession[], jobId: string): JobCounts {
  const mine = sessions.filter(s => s.interviewId === jobId);
  return {
    total: mine.length,
    inProgress: mine.filter(s => s.status === 'in_progress').length,
    completed: mine.filter(s => s.status === 'completed').length,
    strong: mine.filter(s => s.summary?.verdict === 'strong_fit').length,
    possible: mine.filter(s => s.summary?.verdict === 'possible').length,
    notFit: mine.filter(s => s.summary?.verdict === 'not_a_fit').length,
    latestAt: mine.length ? Math.max(...mine.map(s => s.createdAt)) : undefined
  };
}

export function InterviewsPanel() {
  const router = useRouter();
  const authedFetch = useAuthedFetch();
  const [configs, setConfigs] = useState<InterviewConfig[] | null>(null);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBrief, setNewBrief] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authedFetch('/api/rhai/interviews');
    if (res.ok) {
      const d = (await res.json()) as { configs: InterviewConfig[]; sessions: InterviewSession[] };
      setConfigs(d.configs);
      setSessions(d.sessions);
    }
  }, [authedFetch]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const toggleActive = async (id: string, active: boolean) => {
    setConfigs(prev => (prev ? prev.map(c => (c.id === id ? { ...c, active } : c)) : prev));
    await authedFetch('/api/rhai/interviews', { method: 'PATCH', body: JSON.stringify({ id, active }) }).catch(
      () => undefined
    );
  };

  const share = (id: string) => {
    const url = `${window.location.origin}/interview/${id}`;
    navigator.clipboard.writeText(url).catch(() => undefined);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const createRole = async () => {
    if (!newTitle.trim() || !newBrief.trim() || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await authedFetch('/api/rhai/interviews', {
        method: 'POST',
        body: JSON.stringify({ action: 'create', title: newTitle.trim(), brief: newBrief.trim() })
      });
      if (!res.ok) {
        setCreateError((await res.text()) || 'Could not create the role.');
        return;
      }
      const { config } = (await res.json()) as { config: InterviewConfig };
      // Land on the new role's page — Rhea can preview the transcript + edit there.
      router.push(`/interviews/${config.id}`);
    } catch {
      setCreateError('Network error — please try again.');
    } finally {
      setCreating(false);
    }
  };

  if (configs === null) return <p className="text-sm text-ink-400">Loading…</p>;

  const activeCount = configs.filter(c => c.active).length;

  return (
    <div className="space-y-4">
      {/* tool overview strip */}
      <div className="flex flex-wrap gap-2 text-[11px] text-ink-500">
        <span className="rounded-full border border-ink-200 bg-white px-2.5 py-1">
          {configs.length} job{configs.length === 1 ? '' : 's'} · {activeCount} accepting
        </span>
        <span className="rounded-full border border-ink-200 bg-white px-2.5 py-1">
          {sessions.length} application{sessions.length === 1 ? '' : 's'} ·{' '}
          {sessions.filter(s => s.status === 'completed').length} completed
        </span>
      </div>

      {/* jobs — click one to open its applications page */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="eyebrow">Jobs</p>
          <button
            type="button"
            onClick={() => {
              setShowNew(v => !v);
              setCreateError(null);
            }}
            className="rounded-md border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50"
          >
            {showNew ? 'Cancel' : '+ New role'}
          </button>
        </div>

        {showNew && (
          <div className="mb-3 rounded-lg border border-ink-200 bg-white p-4">
            <p className="text-sm font-semibold text-ink-900">Add a role for Rhai to interview for</p>
            <p className="mt-0.5 text-[11px] text-ink-500">
              Give the title and a plain-English brief — what the role is, the requirements, and what you&apos;re looking
              for. Rhai writes the full interview (logistics checks, fit questions, opening message). You can preview it
              on the next screen before sharing.
            </p>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Role title — e.g. Community & events associate"
              maxLength={120}
              className="mt-3 w-full rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-accent focus:outline-none"
            />
            <textarea
              value={newBrief}
              onChange={e => setNewBrief(e.target.value)}
              placeholder={
                'What is the role? Compensation, format (remote/in-person), the actual work, timing, and how long. What kind of person are you after, and what are the deal-breakers (location, availability, start date)?'
              }
              rows={6}
              maxLength={6000}
              className="mt-2 w-full resize-y rounded-md border border-ink-200 px-3 py-2 text-sm leading-relaxed text-ink-900 placeholder:text-ink-400 focus:border-accent focus:outline-none"
            />
            {createError && <p className="mt-2 text-xs text-rose-600">{createError}</p>}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={createRole}
                disabled={!newTitle.trim() || !newBrief.trim() || creating}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
              >
                {creating ? 'Rhai is writing the interview…' : 'Create role'}
              </button>
              <span className="text-[11px] text-ink-400">Takes a few seconds.</span>
            </div>
          </div>
        )}

        {configs.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
            No roles yet.
          </p>
        ) : (
          <div className="space-y-2">
            {configs.map(c => {
              const n = countSessions(sessions, c.id);
              return (
                <div key={c.id} className="rounded-lg border border-ink-200 bg-white transition-colors hover:border-ink-300">
                  <Link href={`/interviews/${c.id}`} className="block px-4 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold text-ink-900">{c.title}</p>
                      <span className="shrink-0 text-xs text-ink-400">
                        {n.total} application{n.total === 1 ? '' : 's'} · {n.completed} completed →
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
                      <span className="font-mono">/interview/{c.id}</span>
                      {c.createdAt > 0 && (
                        <span>
                          created{' '}
                          {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                      {n.latestAt && (
                        <span>
                          latest{' '}
                          {new Date(n.latestAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 pb-1 text-[10px]">
                      {n.strong > 0 && (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                          ✓ {n.strong} strong fit
                        </span>
                      )}
                      {n.possible > 0 && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
                          ~ {n.possible} possible
                        </span>
                      )}
                      {n.notFit > 0 && (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-medium text-rose-700">
                          ✕ {n.notFit} not a fit
                        </span>
                      )}
                      {n.inProgress > 0 && (
                        <span className="rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-ink-500">
                          {n.inProgress} in progress
                        </span>
                      )}
                      {n.total === 0 && <span className="text-ink-400">no applications yet</span>}
                    </div>
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 px-4 py-2">
                    <button
                      type="button"
                      onClick={() => share(c.id)}
                      className="rounded-md border border-ink-200 px-3 py-1 text-xs text-ink-700 hover:bg-ink-50"
                    >
                      {copied === c.id ? '✓ Copied' : 'Copy share link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(c.id, !c.active)}
                      className={`rounded-md px-3 py-1 text-xs font-medium ${
                        c.active
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                      }`}
                    >
                      {c.active ? '● Accepting' : '○ Closed'}
                    </button>
                    <Link
                      href={`/interviews/${c.id}`}
                      className="ml-auto rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-600"
                    >
                      Open applications →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
