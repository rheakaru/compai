'use client';

// Operator review surface for the public "Talk to Rhai" discovery chats
// (heyrhai.com → /talk). Lists every conversation — completed and dropped-off
// — with contact details, Rhai's extracted summary, the full transcript
// (voice clips playable inline), and a link to the pipeline lead it created.

import { useCallback, useEffect, useState } from 'react';
import { useAuthedFetch } from './useAuthedFetch';
import type { DiscoverySession } from '@/lib/rhai/discovery';

export function DiscoveryPanel() {
  const authedFetch = useAuthedFetch();
  const [sessions, setSessions] = useState<DiscoverySession[] | null>(null);

  const load = useCallback(async () => {
    const res = await authedFetch('/api/rhai/discovery');
    if (res.ok) setSessions(((await res.json()) as { sessions: DiscoverySession[] }).sessions);
  }, [authedFetch]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  if (sessions === null) return <p className="text-sm text-ink-400">Loading…</p>;
  if (sessions.length === 0)
    return (
      <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
        No conversations yet — they&apos;ll appear here as people talk to Rhai from the homepage.
      </p>
    );

  const completed = sessions.filter(s => s.status === 'completed').length;
  return (
    <div>
      <p className="eyebrow mb-3">
        {sessions.length} conversation{sessions.length === 1 ? '' : 's'} · {completed} completed
      </p>
      <div className="space-y-3">
        {sessions.map(s => (
          <DiscoveryCard key={s.id} s={s} />
        ))}
      </div>
    </div>
  );
}

function DiscoveryCard({ s }: { s: DiscoverySession }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const done = s.status === 'completed';
  const guestTurns = s.messages.filter(m => m.role === 'guest').length;

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink-900">{s.contact.name}</p>
            {s.contact.company && <span className="text-[11px] text-ink-500">· {s.contact.company}</span>}
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              {done ? '✓ Completed' : `In progress · ${guestTurns} repl${guestTurns === 1 ? 'y' : 'ies'}`}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-ink-500">
            <a href={`mailto:${s.contact.email}`} className="text-indigo-600 hover:underline">
              {s.contact.email}
            </a>{' '}
            · {s.contact.phone}
          </p>
        </div>
        <p className="text-[10px] text-ink-400">
          {new Date(s.createdAt).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>

      {s.summary && (
        <div className="mt-3 rounded-md border border-ink-100 bg-cream-50/60 p-3">
          {s.summary.headline && <p className="text-xs font-semibold text-ink-900">{s.summary.headline}</p>}
          {s.summary.overview && <p className="mt-1 text-xs leading-relaxed text-ink-700">{s.summary.overview}</p>}
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {s.summary.problem && (
              <p className="text-[11px] text-ink-700">
                <span className="font-semibold">Problem:</span> {s.summary.problem}
              </p>
            )}
            {s.summary.timeline && (
              <p className="text-[11px] text-ink-700">
                <span className="font-semibold">Timeline:</span> {s.summary.timeline}
              </p>
            )}
            {s.summary.aiReadiness && (
              <p className="text-[11px] text-ink-700">
                <span className="font-semibold">AI readiness:</span> {s.summary.aiReadiness}
              </p>
            )}
            {s.summary.extras && (
              <p className="text-[11px] text-ink-700">
                <span className="font-semibold">Extras:</span> {s.summary.extras}
              </p>
            )}
          </div>
          {s.summary.contextTags && s.summary.contextTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {s.summary.contextTags.map((t, i) => (
                <span key={i} className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] text-ink-600">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setShowTranscript(v => !v)}
          className="text-[11px] text-indigo-600 hover:underline"
        >
          {showTranscript ? 'Hide transcript' : `Full transcript · ${s.messages.length} messages`}
        </button>
        {s.leadId && (
          <a href={`/leads/${s.leadId}`} className="text-[11px] text-indigo-600 hover:underline">
            Open lead →
          </a>
        )}
      </div>

      {showTranscript && (
        <div className="mt-2 max-h-96 space-y-2 overflow-y-auto rounded-md border border-ink-100 p-3">
          {s.messages.map((m, i) => (
            <div
              key={i}
              className={m.role === 'guest' ? 'flex flex-col items-end gap-1' : 'flex flex-col items-start gap-1'}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-md px-2.5 py-1.5 text-[11px] leading-relaxed ${
                  m.role === 'guest' ? 'bg-ink-900 text-cream' : 'bg-cream-50 text-ink-700'
                }`}
              >
                {m.text}
              </div>
              {m.audioUrl && <audio controls preload="none" src={m.audioUrl} className="h-7 max-w-[85%]" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
