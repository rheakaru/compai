'use client';

// The briefing — Rhai's morning read on the business. This is the FIRST thing
// Rhea sees when she opens the workspace. Auto-runs the "morning pass" once
// per day (guarded by localStorage: never twice on the same date). Otherwise
// shows the cached suggestions from Firestore, with a manual ↻ Refresh so
// she can force a rerun any time. Zero wasted API calls on repeat visits.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthProvider';
import { SUGGESTION_KIND_LABELS, type RhaiSuggestion } from '@/lib/rhai/types';

const STORAGE_KEY = 'rhai.briefing.lastRunDate';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

interface Props {
  /** Called when the user wants to jump to the full Today tab. */
  onOpenToday: () => void;
}

export function BriefingStrip({ onOpenToday }: Props) {
  const { user, getToken } = useAuth();
  const [suggestions, setSuggestions] = useState<RhaiSuggestion[] | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'generating' | 'error'>('idle');
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);

  const authedFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const token = await getToken();
      return fetch(path, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        }
      });
    },
    [getToken]
  );

  const loadCached = useCallback(async (): Promise<RhaiSuggestion[]> => {
    const res = await authedFetch('/api/rhai/today');
    if (!res.ok) throw new Error(await res.text());
    return ((await res.json()) as { suggestions: RhaiSuggestion[] }).suggestions;
  }, [authedFetch]);

  const runMorningPass = useCallback(async () => {
    setState('generating');
    try {
      const res = await authedFetch('/api/rhai/today', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      const fresh = ((await res.json()) as { suggestions: RhaiSuggestion[] }).suggestions;
      setSuggestions(fresh);
      const now = Date.now();
      setLastRunAt(now);
      localStorage.setItem(STORAGE_KEY, todayISO());
      setState('idle');
    } catch {
      setState('error');
    }
  }, [authedFetch]);

  // First mount: read cached suggestions. Auto-run the morning pass once per
  // calendar day. Never on subsequent visits the same day, unless user hits ↻.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setState('loading');
      try {
        const cached = await loadCached();
        if (cancelled) return;
        setSuggestions(cached);
        const last = localStorage.getItem(STORAGE_KEY);
        if (last !== todayISO()) {
          // New day (or first visit) → refresh Rhai's read.
          await runMorningPass();
        } else {
          setState('idle');
        }
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loadCached, runMorningPass]);

  const proposed = useMemo(
    () => (suggestions ?? []).filter(s => s.status === 'proposed'),
    [suggestions]
  );
  const approvedCount = useMemo(
    () => (suggestions ?? []).filter(s => s.status === 'approved').length,
    [suggestions]
  );
  const generatedOn = suggestions?.[0]?.createdAt ?? lastRunAt;

  if (!user) return null;

  return (
    <section className="border-b border-ink-200/70 bg-cream-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Rhai · Briefing</p>
            <h2 className="mt-1 font-display text-3xl leading-tight tracking-tight text-ink-900">
              {greeting()}, Rhea.
            </h2>
            <p className="mt-1 text-sm text-ink-600">
              {state === 'generating'
                ? 'Reading the pipeline, your notes, and the parked ideas…'
                : state === 'loading'
                  ? 'Loading your morning read…'
                  : state === 'error'
                    ? 'Couldn’t reach Rhai. Try refresh.'
                    : proposed.length > 0
                      ? `${proposed.length} concrete move${proposed.length === 1 ? '' : 's'} for today${approvedCount ? ` · ${approvedCount} queued for your Claude Code hands` : ''}.`
                      : suggestions === null
                        ? '—'
                        : 'Nothing urgent — open Ideas to surface parked plays.'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {generatedOn && state === 'idle' && (
              <span className="hidden text-[10px] text-ink-400 sm:inline">
                Last read {relativeTime(generatedOn)}
              </span>
            )}
            <button
              type="button"
              onClick={runMorningPass}
              disabled={state === 'generating' || state === 'loading'}
              className="rounded-md border border-ink-300 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-white/70 disabled:opacity-60"
              title="Force a fresh briefing"
            >
              {state === 'generating' ? 'Reading…' : '↻ Refresh'}
            </button>
            <button
              type="button"
              onClick={onOpenToday}
              className="rounded-md bg-ink-900 px-3 py-1.5 text-xs font-medium text-cream hover:bg-ink-800"
            >
              Open Today →
            </button>
          </div>
        </div>

        {proposed.length > 0 && (
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {proposed.slice(0, 3).map((s, i) => (
              <li
                key={s.id}
                className="rounded-lg border border-ink-200 bg-white p-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-lg text-ink-400">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="eyebrow text-ink-500">
                    {SUGGESTION_KIND_LABELS[s.kind]}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-semibold text-ink-900">{s.title}</p>
                {s.leadLabel && (
                  <p className="mt-0.5 text-[11px] text-ink-500">{s.leadLabel}</p>
                )}
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-ink-600">
                  {s.detail}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
