'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthedFetch } from './useAuthedFetch';

interface LeadSuggestion {
  leadId: string;
  company?: string;
  person?: string;
  score: number;
  reasons: string[];
}

interface RecentCall {
  id: string;
  title: string;
  date: number;
  attendees: string[];
  status: 'ingested' | 'unmatched' | 'capture-gap' | 'internal' | 'new';
  leadId?: string;
  suggestions?: LeadSuggestion[];
}

interface LeadOption {
  id: string;
  company: string;
  person: string;
}

interface CallsResponse {
  recent: RecentCall[];
  leadOptions: LeadOption[];
  firefliesError?: string;
}

const STATUS_LABEL: Record<RecentCall['status'], { label: string; cls: string }> = {
  ingested: { label: 'On profile', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  unmatched: { label: 'Needs linking', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  new: { label: 'Needs linking', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  'capture-gap': { label: 'No audio captured', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  internal: { label: 'Internal', cls: 'bg-ink-50 text-ink-500 border-ink-200' }
};

export function RhaiCalls() {
  const authedFetch = useAuthedFetch();
  const [data, setData] = useState<CallsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [linking, setLinking] = useState<string | null>(null); // transcriptId in flight
  const [picker, setPicker] = useState<Record<string, string>>({}); // transcriptId → leadId

  const load = useCallback(async () => {
    try {
      const res = await authedFetch('/api/rhai/fireflies');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as CallsResponse);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await authedFetch('/api/rhai/cron/fireflies-sync', {
        method: 'POST',
        body: JSON.stringify({})
      });
      if (!res.ok) throw new Error(`Sync failed (HTTP ${res.status})`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  async function link(transcriptId: string, leadId: string) {
    setLinking(transcriptId);
    try {
      const res = await authedFetch('/api/rhai/fireflies', {
        method: 'POST',
        body: JSON.stringify({ transcriptId, leadId })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Link failed (HTTP ${res.status})`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLinking(null);
    }
  }

  if (loading) return <p className="text-sm text-ink-500">Loading calls…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-500">
          Calls sync automatically every morning at 6:30. Linked calls land on the client&apos;s
          profile as a Discovery Record; linking a call also teaches Rhai the client&apos;s email
          for future auto-matching.
        </p>
        <button
          type="button"
          onClick={syncNow}
          disabled={syncing}
          className="shrink-0 rounded-md border border-ink-200 px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      {error && (
        <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </p>
      )}
      {data?.firefliesError && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Fireflies list unavailable: {data.firefliesError}
        </p>
      )}

      {(data?.recent ?? []).length === 0 && !data?.firefliesError && (
        <p className="text-sm text-ink-500">No calls in the last 14 days.</p>
      )}

      <div className="space-y-2">
        {(data?.recent ?? []).map(call => {
          const badge = STATUS_LABEL[call.status];
          const needsLink = call.status === 'new' || call.status === 'unmatched';
          const linkedLead = call.leadId
            ? data?.leadOptions.find(l => l.id === call.leadId)
            : undefined;
          return (
            <div key={call.id} className="rounded-md border border-ink-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-ink-900">{call.title || '(untitled call)'}</p>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${badge.cls}`}>
                    {badge.label}
                    {linkedLead ? ` — ${linkedLead.company || linkedLead.person}` : ''}
                  </span>
                  <span className="text-[11px] text-ink-400">
                    {new Date(call.date).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short'
                    })}
                  </span>
                </div>
              </div>
              {call.attendees.length > 0 && (
                <p className="mt-0.5 truncate text-[11px] text-ink-500">
                  {call.attendees.join(' · ')}
                </p>
              )}

              {needsLink && (
                <div className="mt-2 space-y-1.5">
                  {(call.suggestions ?? []).map(s => (
                    <div key={s.leadId} className="flex items-center justify-between gap-2">
                      <p className="text-xs text-ink-600">
                        <span className="font-medium text-ink-900">
                          {s.company || s.person}
                        </span>{' '}
                        — {s.reasons.join('; ')}
                      </p>
                      <button
                        type="button"
                        disabled={linking === call.id}
                        onClick={() => link(call.id, s.leadId)}
                        className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-600 disabled:opacity-50"
                      >
                        {linking === call.id ? 'Linking…' : 'Link'}
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-0.5">
                    <select
                      value={picker[call.id] ?? ''}
                      onChange={e => setPicker(p => ({ ...p, [call.id]: e.target.value }))}
                      className="rounded-md border border-ink-200 px-2 py-1 text-xs text-ink-700"
                    >
                      <option value="">
                        {call.suggestions?.length ? 'Someone else…' : 'Pick a client…'}
                      </option>
                      {data?.leadOptions.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.company || l.person}
                        </option>
                      ))}
                    </select>
                    {picker[call.id] && (
                      <button
                        type="button"
                        disabled={linking === call.id}
                        onClick={() => link(call.id, picker[call.id])}
                        className="rounded-md border border-ink-200 px-2.5 py-1 text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                      >
                        {linking === call.id ? 'Linking…' : 'Link to selected'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
