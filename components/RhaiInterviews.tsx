'use client';

// Operator review surface for Rhai-conducted interviews: roles with share
// links + open/close toggles, and every candidate session with verdict,
// summary, hard-check notes, their questions for Rhea, and the transcript.

import { useCallback, useEffect, useState } from 'react';
import { useAuthedFetch } from './useAuthedFetch';
import type { InterviewConfig, InterviewSession, InterviewSummary } from '@/lib/rhai/types';

const VERDICT_CHIP: Record<InterviewSummary['verdict'], string> = {
  strong_fit: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  possible: 'bg-amber-50 text-amber-800 border-amber-200',
  not_a_fit: 'bg-rose-50 text-rose-700 border-rose-200'
};

const VERDICT_LABEL: Record<InterviewSummary['verdict'], string> = {
  strong_fit: '✓ Strong fit',
  possible: '~ Possible',
  not_a_fit: '✕ Not a fit'
};

export function InterviewsPanel() {
  const authedFetch = useAuthedFetch();
  const [configs, setConfigs] = useState<InterviewConfig[]>([]);
  const [sessions, setSessions] = useState<InterviewSession[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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
    setConfigs(prev => prev.map(c => (c.id === id ? { ...c, active } : c)));
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

  return (
    <div className="space-y-6">
      {/* roles */}
      <section>
        <p className="eyebrow mb-2">Open roles</p>
        <div className="space-y-2">
          {configs.map(c => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900">{c.title}</p>
                <p className="text-[11px] text-ink-400">/interview/{c.id}</p>
              </div>
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
                  c.active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                }`}
              >
                {c.active ? '● Accepting' : '○ Closed'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* candidates */}
      <section>
        <p className="eyebrow mb-2">
          Candidates {sessions ? `· ${sessions.length}` : ''}
        </p>
        {sessions === null ? (
          <p className="text-sm text-ink-400">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
            No interviews yet — share the link and they&apos;ll appear here as they come in.
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <SessionCard key={s.id} s={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SessionCard({ s }: { s: InterviewSession }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const done = s.status === 'completed';
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink-900">{s.candidate.name}</p>
            {done && s.summary ? (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${VERDICT_CHIP[s.summary.verdict]}`}>
                {VERDICT_LABEL[s.summary.verdict]}
              </span>
            ) : (
              <span className="rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[10px] text-ink-500">
                {done ? 'completed' : 'in progress'}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-ink-500">
            {s.candidate.email} · {s.candidate.phone}
            {s.candidate.resumeUrl && (
              <>
                {' · '}
                <a href={s.candidate.resumeUrl} target="_blank" rel="noreferrer" className="text-indigo-600 underline">
                  resume
                </a>
              </>
            )}
          </p>
        </div>
        <p className="text-[10px] text-ink-400">
          {new Date(s.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {s.summary && (
        <div className="mt-3 rounded-md border border-ink-100 bg-cream-50/60 p-3">
          <p className="text-xs leading-relaxed text-ink-700">{s.summary.summary}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {s.summary.strengths.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Strengths</p>
                <ul className="mt-0.5 list-disc pl-4 text-[11px] text-ink-700">
                  {s.summary.strengths.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
            {s.summary.concerns.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">Concerns</p>
                <ul className="mt-0.5 list-disc pl-4 text-[11px] text-ink-700">
                  {s.summary.concerns.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {s.summary.hardCheckNotes && (
            <p className="mt-2 text-[11px] text-ink-600">
              <span className="font-semibold">Hard checks:</span> {s.summary.hardCheckNotes}
            </p>
          )}
        </div>
      )}

      {s.questionsForRhea && (
        <div className="mt-2 rounded-md border border-indigo-100 bg-indigo-50/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700">Their questions for you</p>
          <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink-700">{s.questionsForRhea}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowTranscript(v => !v)}
        className="mt-2 text-[11px] text-indigo-600 hover:underline"
      >
        {showTranscript ? 'Hide transcript' : `Full transcript · ${s.messages.length} messages`}
      </button>
      {showTranscript && (
        <div className="mt-2 max-h-96 space-y-2 overflow-y-auto rounded-md border border-ink-100 p-3">
          {s.messages.map((m, i) => (
            <div
              key={i}
              className={m.role === 'candidate' ? 'flex flex-col items-end gap-1' : 'flex flex-col items-start gap-1'}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-md px-2.5 py-1.5 text-[11px] leading-relaxed ${
                  m.role === 'candidate' ? 'bg-ink-900 text-cream' : 'bg-cream-50 text-ink-700'
                }`}
              >
                {m.text}
              </div>
              {m.audioUrl && (
                <audio controls preload="none" src={m.audioUrl} className="h-7 max-w-[85%]" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
