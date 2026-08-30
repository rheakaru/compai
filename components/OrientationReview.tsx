'use client';

// Operator-only review of the intern's orientation, at /admin/orientation.
// Shows her progress, every voice takeaway (transcript + playable audio), her
// exercise answers, and the documents she uploaded — so Rhea and Yeshoda can
// see how engaged she's been. Also has the button that pulls the pitch-call
// transcripts from Fireflies into her "how we actually pitch" module.

import { useCallback, useEffect, useState } from 'react';
import { useAuthedFetch } from './useAuthedFetch';
import { EXERCISE, MILESTONES, ONBOARDING_TOKEN, READINGS, REQUIRED_DOCS } from '@/lib/rhai/onboarding';

interface Takeaway { transcript: string; audioUrl: string | null; at: number }
interface DocRec { label: string; filename: string; url: string | null; at: number }
interface State {
  progress: string[];
  exercise: Record<string, string>;
  takeaways: Record<string, Takeaway>;
  docs: Record<string, DocRec>;
  transcriptsPulledAt: number | null;
  pitchTranscripts: { title: string }[];
}

// Human labels for the takeaway prompts, keyed by their promptId.
const TAKEAWAY_LABELS: Record<string, string> = {
  ...Object.fromEntries(READINGS.map(r => [r.id, r.title])),
  'tone-practice': 'Tone practice — the follow-up message'
};

export function OrientationReview() {
  const authedFetch = useAuthedFetch();
  const [state, setState] = useState<State | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullMsg, setPullMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authedFetch('/api/admin/orientation');
      if (res.status === 401 || res.status === 403) {
        setErr('Sign in with your operator account to view this.');
        return;
      }
      if (!res.ok) {
        setErr('Could not load the orientation.');
        return;
      }
      setState((await res.json()) as State);
      setErr(null);
    } catch {
      setErr('Could not load the orientation.');
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const pull = async () => {
    setPulling(true);
    setPullMsg(null);
    try {
      const res = await authedFetch('/api/admin/orientation/pull-transcripts', { method: 'POST' });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; pulled?: string[]; missing?: string[]; error?: string };
      if (j.ok) {
        setPullMsg(
          `Pulled: ${(j.pulled ?? []).join(', ') || 'none'}${
            j.missing?.length ? ` · not found: ${j.missing.join(', ')}` : ''
          }`
        );
        await load();
      } else {
        setPullMsg(j.error || 'Pull failed.');
      }
    } catch {
      setPullMsg('Pull failed.');
    }
    setPulling(false);
  };

  if (err) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-ink-600">
        <h1 className="font-display text-2xl text-ink-900">Orientation review</h1>
        <p className="mt-3">{err}</p>
      </main>
    );
  }
  if (!state) {
    return <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-ink-500">Loading…</main>;
  }

  const done = new Set(state.progress);
  const completed = MILESTONES.filter(m => done.has(m.id)).length;
  const takeawayEntries = Object.entries(state.takeaways);
  const docEntries = REQUIRED_DOCS.map(d => ({ ...d, rec: state.docs[d.id] }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Intern orientation</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-ink-900">How it&apos;s going</h1>
        </div>
        <a
          href={`/orient/${ONBOARDING_TOKEN}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-accent underline-offset-4 hover:underline"
        >
          Open her orientation link ↗
        </a>
      </div>

      {/* Progress */}
      <div className="mt-6 rounded-xl border border-ink-200 bg-white p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-ink-900">
            {completed}/{MILESTONES.length} milestones done
          </span>
          <span className="text-ink-500">{Math.round((completed / MILESTONES.length) * 100)}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-ink-100">
          <div className="h-full rounded-full bg-accent" style={{ width: `${(completed / MILESTONES.length) * 100}%` }} />
        </div>
        <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
          {MILESTONES.map(m => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span className={done.has(m.id) ? 'text-emerald-600' : 'text-ink-300'}>{done.has(m.id) ? '✓' : '○'}</span>
              <span className={done.has(m.id) ? 'text-ink-800' : 'text-ink-400'}>{m.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pull transcripts */}
      <div className="mt-6 rounded-xl border border-ink-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-ink-900">Pitch-call transcripts</p>
            <p className="mt-1 text-xs text-ink-500">
              Pulls the latest Hester, Halol and Century calls from Fireflies into her &ldquo;how we actually
              pitch&rdquo; module.
              {state.transcriptsPulledAt
                ? ` Last pulled ${new Date(state.transcriptsPulledAt).toLocaleString('en-IN')} · ${state.pitchTranscripts.length} call(s).`
                : ' Not pulled yet.'}
            </p>
          </div>
          <button
            type="button"
            onClick={pull}
            disabled={pulling}
            className="rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-cream hover:bg-ink-800 disabled:opacity-50"
          >
            {pulling ? 'Pulling…' : 'Pull transcripts'}
          </button>
        </div>
        {pullMsg && <p className="mt-3 text-xs text-ink-600">{pullMsg}</p>}
      </div>

      {/* Voice takeaways */}
      <h2 className="mt-10 font-display text-xl text-ink-900">Voice takeaways</h2>
      {takeawayEntries.length === 0 ? (
        <p className="mt-2 text-sm text-ink-500">None yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {takeawayEntries.map(([id, t]) => (
            <div key={id} className="rounded-xl border border-ink-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
                {TAKEAWAY_LABELS[id] ?? id}
              </p>
              {t.audioUrl && <audio controls src={t.audioUrl} className="mt-2 h-9 w-full max-w-md" />}
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{t.transcript || '(no transcript)'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Exercise answers */}
      <h2 className="mt-10 font-display text-xl text-ink-900">Her answers on the {EXERCISE.client}</h2>
      <div className="mt-3 space-y-3">
        {EXERCISE.steps.map((step, i) => (
          <div key={step.id} className="rounded-xl border border-ink-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              Step {i + 1} · {step.stage}
            </p>
            <p className="mt-1 text-sm text-ink-500">{step.question}</p>
            <p className="mt-2 rounded-lg bg-cream-50 p-3 text-sm leading-relaxed text-ink-800">
              {state.exercise[step.id] || '(not answered yet)'}
            </p>
          </div>
        ))}
      </div>

      {/* Documents */}
      <h2 className="mt-10 font-display text-xl text-ink-900">Documents</h2>
      <div className="mt-3 space-y-2">
        {docEntries.map(d => (
          <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white p-4 text-sm">
            <span className="text-ink-800">{d.label}</span>
            {d.rec?.url ? (
              <a href={d.rec.url} target="_blank" rel="noreferrer" className="text-accent underline">
                {d.rec.filename || 'view'}
              </a>
            ) : (
              <span className="text-ink-400">not uploaded</span>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
