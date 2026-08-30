'use client';

// The interactive intern onboarding + orientation at /orient/<token>. Content
// lives in lib/rhai/onboarding.ts; this renders it as a milestone flow that
// saves progress, voice takeaways (re-recordable, transcript shown), exercise
// answers, and document uploads to the server — so Rhea and Yeshoda can see how
// engaged she's been. Uses the site design system (cream · Fraunces · terracotta).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVoice } from './useVoice';
import {
  EXERCISE,
  FOCUS_AREAS,
  INTERN,
  LOGISTICS,
  MANDATORY_DOC_IDS,
  MILESTONES,
  ONBOARDING_TOKEN,
  OUTCOME,
  PROJECT_STATUS,
  READINGS,
  REQUIRED_DOCS,
  TONE_INTRO,
  TONE_PRACTICE,
  TONE_RULES
} from '@/lib/rhai/onboarding';

interface Takeaway {
  transcript: string;
  audioUrl: string | null;
  at: number;
}
interface DocRec {
  label: string;
  filename: string;
  url: string | null;
  at: number;
}
interface Sentence { speaker: string; text: string }
interface PitchCall { id: string; title: string; dateLabel: string; overview?: string; sentences: Sentence[] }
interface State {
  progress: string[];
  exercise: Record<string, string>;
  takeaways: Record<string, Takeaway>;
  docs: Record<string, DocRec>;
  pitchTranscripts?: PitchCall[];
}

export function InternOnboarding() {
  const token = ONBOARDING_TOKEN;
  const [state, setState] = useState<State | null>(null);
  const [active, setActive] = useState<string>('welcome');

  useEffect(() => {
    fetch(`/api/rhai/onboarding?token=${encodeURIComponent(token)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: State | null) =>
        setState(d ?? { progress: [], exercise: {}, takeaways: {}, docs: {}, pitchTranscripts: [] })
      )
      .catch(() => setState({ progress: [], exercise: {}, takeaways: {}, docs: {}, pitchTranscripts: [] }));
  }, [token]);

  const done = useMemo(() => new Set(state?.progress ?? []), [state]);

  const markDone = useCallback(
    (id: string) => {
      setState(prev => {
        if (!prev) return prev;
        if (prev.progress.includes(id)) return prev;
        const progress = [...prev.progress, id];
        void fetch('/api/rhai/onboarding', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token, action: 'progress', milestones: progress })
        });
        return { ...prev, progress };
      });
    },
    [token]
  );

  const saveTakeaway = useCallback(
    async (promptId: string, transcript: string, audioBlob: Blob | null) => {
      const form = new FormData();
      form.append('token', token);
      form.append('kind', 'takeaway');
      form.append('promptId', promptId);
      form.append('transcript', transcript);
      // Upload the real recording when we have one. A transcript with no audio
      // still saves — we never fabricate an empty audio file.
      if (audioBlob && audioBlob.size > 0) {
        const ext = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
        form.append('file', audioBlob, `${promptId}.${ext}`);
      }
      const res = await fetch('/api/rhai/onboarding', { method: 'POST', body: form });
      const j = (await res.json().catch(() => ({}))) as { url?: string; audioUrl?: string };
      setState(prev =>
        prev
          ? {
              ...prev,
              takeaways: {
                ...prev.takeaways,
                [promptId]: { transcript, audioUrl: j.url ?? j.audioUrl ?? prev.takeaways[promptId]?.audioUrl ?? null, at: Date.now() }
              }
            }
          : prev
      );
    },
    [token]
  );

  const saveExercise = useCallback(
    (stepId: string, response: string) => {
      setState(prev => (prev ? { ...prev, exercise: { ...prev.exercise, [stepId]: response } } : prev));
      void fetch('/api/rhai/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, action: 'exercise', stepId, response })
      });
    },
    [token]
  );

  const uploadDoc = useCallback(
    async (docId: string, label: string, file: File) => {
      const form = new FormData();
      form.append('token', token);
      form.append('kind', 'doc');
      form.append('docId', docId);
      form.append('label', label);
      form.append('filename', file.name);
      form.append('file', file);
      const res = await fetch('/api/rhai/onboarding', { method: 'POST', body: form });
      const j = (await res.json().catch(() => ({}))) as { url?: string };
      setState(prev =>
        prev
          ? { ...prev, docs: { ...prev.docs, [docId]: { label, filename: file.name, url: j.url ?? null, at: Date.now() } } }
          : prev
      );
    },
    [token]
  );

  if (!state) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream text-ink-500">
        <p className="text-sm">Loading your orientation…</p>
      </main>
    );
  }

  const completed = MILESTONES.filter(m => done.has(m.id)).length;
  const docsReady = MANDATORY_DOC_IDS.every(id => !!state.docs[id]);

  return (
    <main className="min-h-screen bg-cream text-ink-900">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-ink-200/60 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <span className="flex items-baseline gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
            <span className="font-display text-[17px] font-medium tracking-tight">Rhai</span>
            <span className="ml-2 text-xs text-ink-400">Orientation</span>
          </span>
          <span className="text-xs text-ink-500">
            {completed}/{MILESTONES.length} done
          </span>
        </div>
        <div className="h-0.5 w-full bg-ink-100">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${Math.round((completed / MILESTONES.length) * 100)}%` }}
          />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[220px_1fr]">
        {/* Rail */}
        <nav className="hidden lg:block">
          <ol className="sticky top-24 space-y-1 text-sm">
            {MILESTONES.map(m => (
              <li key={m.id}>
                <a
                  href={`#${m.id}`}
                  onClick={() => setActive(m.id)}
                  className={`flex items-start gap-2 rounded-md px-2 py-1.5 ${
                    active === m.id ? 'bg-white text-ink-900' : 'text-ink-500 hover:text-ink-900'
                  }`}
                >
                  <span
                    className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px] ${
                      done.has(m.id) ? 'border-accent bg-accent text-white' : 'border-ink-300 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                  <span className="leading-snug">{m.label}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Content */}
        <div className="min-w-0 space-y-12">
          {/* Welcome */}
          <Section id="welcome" done={done.has('welcome')}>
            <p className="eyebrow">Welcome{INTERN.name ? `, ${INTERN.name.split(' ')[0]}` : ''}</p>
            <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight text-ink-900 sm:text-4xl">
              Your first days at Rhai.
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-700">
              This is a self-paced orientation. Read and watch each part, then tell us your takeaway in your own
              voice — record, listen back, re-record until it&apos;s right. We read every one, so this is also how we
              get to know how you think. The outcome we care about most this internship:{' '}
              <strong className="text-ink-900">{OUTCOME.toLowerCase()}</strong>
            </p>
            <div className="mt-6 rounded-xl border border-ink-200 bg-white p-5 text-sm leading-relaxed text-ink-700">
              <p>
                <strong className="text-ink-900">The practical bits.</strong> Until 4 September, come to the Judicial
                Layout office in person — being in the room is the fastest way to learn. Through September, Rhea is
                travelling, so <strong className="text-ink-900">{INTERN.pointPerson}</strong> is your point person. Go
                to her early and often.
              </p>
            </div>
            <CompleteButton done={done.has('welcome')} onClick={() => markDone('welcome')} label="Got it, let's start" />
          </Section>

          {/* Readings */}
          {READINGS.map(r => {
            const mid = `read-${r.id}`;
            const t = state.takeaways[r.id];
            return (
              <Section key={r.id} id={mid} done={done.has(mid)}>
                <p className="eyebrow">{r.kicker}</p>
                <h2 className="mt-2 font-display text-2xl tracking-tight text-ink-900">{r.title}</h2>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-700">{r.body}</p>
                {r.href && (
                  <a
                    href={r.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-sm text-accent underline-offset-4 hover:underline"
                  >
                    {r.hrefLabel} ↗
                  </a>
                )}
                {r.id === 'how-we-pitch' && <PitchTranscripts calls={state.pitchTranscripts ?? []} />}
                <VoiceTakeaway
                  promptId={r.id}
                  prompt={r.takeawayPrompt}
                  token={token}
                  existing={t}
                  onSaved={async (transcript, blobUrl) => {
                    await saveTakeaway(r.id, transcript, blobUrl);
                    markDone(mid);
                  }}
                />
              </Section>
            );
          })}

          {/* Exercise */}
          <Section id="exercise" done={done.has('exercise')}>
            <p className="eyebrow">What would you do?</p>
            <h2 className="mt-2 font-display text-2xl tracking-tight text-ink-900">
              A real call — {EXERCISE.client}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-700">{EXERCISE.intro}</p>
            {EXERCISE.isTemplate && (
              <p className="mt-2 text-xs italic text-ink-400">
                (Illustrative walkthrough — to be swapped for the actual transcript.)
              </p>
            )}
            <div className="mt-6 space-y-4">
              {EXERCISE.steps.map((step, i) => (
                <ExerciseStepCard
                  key={step.id}
                  index={i + 1}
                  step={step}
                  token={token}
                  savedAnswer={state.exercise[step.id] ?? ''}
                  onAnswer={resp => saveExercise(step.id, resp)}
                />
              ))}
            </div>
            <CompleteButton
              done={done.has('exercise')}
              onClick={() => markDone('exercise')}
              label="I've worked through the call"
            />
          </Section>

          {/* Tone */}
          <Section id="tone" done={done.has('tone')}>
            <p className="eyebrow">Before you do any outbound</p>
            <h2 className="mt-2 font-display text-2xl tracking-tight text-ink-900">Learn our voice.</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-700">{TONE_INTRO}</p>
            <div className="mt-6 space-y-3">
              {TONE_RULES.map((rule, i) => (
                <div key={i} className="grid gap-3 rounded-xl border border-ink-200 bg-white p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Do</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-700">{rule.do}</p>
                  </div>
                  <div className="border-t border-ink-100 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-500">Don&apos;t</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-500">{rule.dont}</p>
                  </div>
                </div>
              ))}
            </div>
            <VoiceTakeaway
              promptId="tone-practice"
              prompt={TONE_PRACTICE}
              token={token}
              existing={state.takeaways['tone-practice']}
              onSaved={async (transcript, blobUrl) => {
                await saveTakeaway('tone-practice', transcript, blobUrl);
                markDone('tone');
              }}
            />
          </Section>

          {/* Project status */}
          <Section id="status" done={done.has('status')}>
            <p className="eyebrow">The picture right now</p>
            <h2 className="mt-2 font-display text-2xl tracking-tight text-ink-900">Where the company is.</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {PROJECT_STATUS.map(s => (
                <div key={s.title} className="rounded-xl border border-ink-200 bg-white p-5">
                  <p className="font-medium text-ink-900">{s.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{s.body}</p>
                </div>
              ))}
            </div>
            <CompleteButton done={done.has('status')} onClick={() => markDone('status')} label="I'm caught up" />
          </Section>

          {/* Focus + logistics */}
          <Section id="focus" done={done.has('focus')}>
            <p className="eyebrow">What this internship is about</p>
            <h2 className="mt-2 font-display text-2xl tracking-tight text-ink-900">Your focus areas & rhythm.</h2>
            <div className="mt-5 space-y-3">
              {FOCUS_AREAS.map((f, i) => (
                <div key={f.title} className="flex gap-4 rounded-xl border border-ink-200 bg-white p-4">
                  <span className="font-display text-lg text-accent">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="font-medium text-ink-900">{f.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {LOGISTICS.map(l => (
                <div key={l.label} className="rounded-xl border border-accent/30 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">{l.label}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{l.body}</p>
                </div>
              ))}
            </div>
            <CompleteButton done={done.has('focus')} onClick={() => markDone('focus')} label="Understood" />
          </Section>

          {/* Documents */}
          <Section id="docs" done={done.has('docs')}>
            <p className="eyebrow">For HR</p>
            <h2 className="mt-2 font-display text-2xl tracking-tight text-ink-900">Upload your documents.</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-700">
              These are stored privately for onboarding. A clear photo or scan of each is fine.
            </p>
            <div className="mt-5 space-y-3">
              {REQUIRED_DOCS.map(d => (
                <DocRow key={d.id} doc={d} existing={state.docs[d.id]} onUpload={f => uploadDoc(d.id, d.label, f)} />
              ))}
            </div>
            <CompleteButton
              done={done.has('docs')}
              onClick={() => markDone('docs')}
              label="I've uploaded what I have"
            />
          </Section>

          {/* Letters */}
          <Section id="letters" done={done.has('letters')}>
            <p className="eyebrow">The paperwork</p>
            <h2 className="mt-2 font-display text-2xl tracking-tight text-ink-900">Your offer & joining letters.</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-700">
              Generated from Rhai, signed by Rhea. They carry the internship terms — a 3-month term, a two-week
              mutual-fit window, confidentiality and non-compete. Review, sign, and return one copy.
            </p>
            {docsReady ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={`/api/rhai/onboarding/letter?token=${encodeURIComponent(token)}&type=offer`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => markDone('letters')}
                  className="rounded-md bg-ink-900 px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink-800"
                >
                  Offer letter (PDF) ↗
                </a>
                <a
                  href={`/api/rhai/onboarding/letter?token=${encodeURIComponent(token)}&type=joining`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => markDone('letters')}
                  className="rounded-md border border-ink-300 bg-white/70 px-4 py-2.5 text-sm font-medium text-ink-800 hover:bg-white"
                >
                  Joining letter (PDF) ↗
                </a>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-ink-300 bg-cream-50 p-4 text-sm text-ink-600">
                🔒 Your letters unlock once your documents are uploaded above (Aadhaar, PAN, bank, and education
                certificates). Upload them, and this will open.
              </div>
            )}
          </Section>

          <div className="rounded-xl border border-ink-200 bg-white p-6 text-center">
            <p className="font-display text-xl text-ink-900">
              {completed === MILESTONES.length ? "That's everything — welcome aboard." : "Take your time."}
            </p>
            <p className="mt-2 text-sm text-ink-600">
              Anything unclear? Message {INTERN.pointPerson}. We&apos;re glad you&apos;re here.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function Section({ id, done, children }: { id: string; done: boolean; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className={`rounded-2xl border p-6 sm:p-8 ${done ? 'border-ink-200 bg-cream-50' : 'border-ink-200 bg-white'}`}>
        {children}
      </div>
    </section>
  );
}

function CompleteButton({ done, onClick, label }: { done: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={done}
      className={`mt-6 rounded-md px-4 py-2 text-sm font-medium ${
        done ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-900 text-cream hover:bg-ink-800'
      }`}
    >
      {done ? '✓ Done' : label}
    </button>
  );
}

// One voice takeaway: record → transcript appears (editable) → save. Re-record
// replaces. Shows the saved answer + audio if it already exists.
function VoiceTakeaway({
  promptId,
  prompt,
  token,
  existing,
  onSaved
}: {
  promptId: string;
  prompt: string;
  token: string;
  existing?: Takeaway;
  onSaved: (transcript: string, audioBlob: Blob | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState(existing?.transcript ?? '');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!existing);
  const onText = useCallback((t: string) => setDraft(d => (d ? `${d} ${t}` : t)), []);
  const { listening, supported, toggle, error, lastAudioUrl, lastAudioBlob } = useVoice(onText, {
    kind: 'discovery',
    sessionId: token
  });

  useEffect(() => {
    if (lastAudioUrl) setAudioUrl(lastAudioUrl);
    if (lastAudioBlob) setAudioBlob(lastAudioBlob);
  }, [lastAudioUrl, lastAudioBlob]);

  const save = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    await onSaved(draft.trim(), audioBlob);
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="mt-6 rounded-xl border border-accent/30 bg-cream-50 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">Your takeaway — in your voice</p>
      <p className="mt-1.5 text-sm font-medium text-ink-800">{prompt}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {supported ? (
          <button
            type="button"
            onClick={toggle}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
              listening ? 'bg-rose-500 text-white' : 'bg-accent text-white hover:bg-accent-600'
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${listening ? 'animate-pulse bg-white' : 'bg-white'}`} />
            {listening ? 'Stop recording' : saved || draft ? 'Re-record' : 'Record'}
          </button>
        ) : (
          <span className="text-xs text-ink-400">Mic not available here — type your answer below.</span>
        )}
        {audioUrl && <audio controls src={audioUrl} className="h-9" />}
        {existing?.audioUrl && !audioUrl && <audio controls src={existing.audioUrl} className="h-9" />}
      </div>
      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}

      <textarea
        value={draft}
        onChange={e => {
          setDraft(e.target.value);
          setSaved(false);
        }}
        placeholder="Your words appear here as you speak — you can edit before saving."
        rows={4}
        className="mt-3 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm leading-relaxed text-ink-800"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !draft.trim()}
          className="rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-cream hover:bg-ink-800 disabled:opacity-40"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved — save again' : 'Save takeaway'}
        </button>
        {saved && <span className="text-xs text-emerald-700">Saved. Rhea can see this.</span>}
      </div>
    </div>
  );
}

// One exercise step: context + question, her answer (voice or text), then a
// reveal of what actually happened once she's committed an answer.
function ExerciseStepCard({
  index,
  step,
  token,
  savedAnswer,
  onAnswer
}: {
  index: number;
  step: { id: string; stage: string; context: string; question: string; whatHappened: string };
  token: string;
  savedAnswer: string;
  onAnswer: (resp: string) => void;
}) {
  const [draft, setDraft] = useState(savedAnswer);
  const [revealed, setRevealed] = useState(!!savedAnswer);
  const onText = useCallback((t: string) => setDraft(d => (d ? `${d} ${t}` : t)), []);
  const { listening, supported, toggle } = useVoice(onText, { kind: 'discovery', sessionId: token });

  const commit = () => {
    if (!draft.trim()) return;
    onAnswer(draft.trim());
    setRevealed(true);
  };

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
        Step {index} · {step.stage}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-700">{step.context}</p>
      <p className="mt-3 text-sm font-medium text-ink-900">{step.question}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {supported && (
          <button
            type="button"
            onClick={toggle}
            className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium ${
              listening ? 'bg-rose-500 text-white' : 'bg-accent text-white hover:bg-accent-600'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-white" />
            {listening ? 'Stop' : 'Record your move'}
          </button>
        )}
      </div>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder="What would you do next? Speak or type…"
        rows={3}
        className="mt-3 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm leading-relaxed text-ink-800"
      />
      {!revealed ? (
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          className="mt-3 rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-cream hover:bg-ink-800 disabled:opacity-40"
        >
          Lock in my answer & reveal
        </button>
      ) : (
        <div className="mt-4 rounded-lg border-l-2 border-accent bg-cream-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">What actually happened</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{step.whatHappened}</p>
        </div>
      )}
    </div>
  );
}

function PitchTranscripts({ calls }: { calls: PitchCall[] }) {
  const [open, setOpen] = useState<string | null>(calls[0]?.id ?? null);
  if (!calls.length) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-ink-300 bg-cream-50 p-4 text-sm text-ink-500">
        The real call recordings will appear here once they&apos;ve been pulled in. For now, work through the call in
        the next section.
      </div>
    );
  }
  return (
    <div className="mt-4 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Real calls — read one all the way through</p>
      {calls.map(c => {
        const isOpen = open === c.id;
        return (
          <div key={c.id} className="overflow-hidden rounded-xl border border-ink-200 bg-white">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : c.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-cream-50"
            >
              <span>
                <span className="text-sm font-medium text-ink-900">{c.title}</span>
                {c.dateLabel && <span className="ml-2 text-xs text-ink-400">{c.dateLabel}</span>}
              </span>
              <span className="text-ink-400">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && (
              <div className="border-t border-ink-100 px-4 py-3">
                {c.overview && (
                  <p className="mb-3 rounded-lg bg-cream-50 p-3 text-xs italic leading-relaxed text-ink-600">
                    {c.overview}
                  </p>
                )}
                <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                  {c.sentences.map((sent, i) => (
                    <p key={i} className="text-[13px] leading-relaxed text-ink-700">
                      <span className="font-medium text-ink-900">{sent.speaker}:</span> {sent.text}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DocRow({
  doc,
  existing,
  onUpload
}: {
  doc: { id: string; label: string; note?: string };
  existing?: DocRec;
  onUpload: (file: File) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-900">{doc.label}</p>
        {doc.note && <p className="text-xs text-ink-500">{doc.note}</p>}
        {existing?.filename && (
          <p className="mt-1 text-xs text-emerald-700">
            ✓ {existing.filename}
            {existing.url && (
              <a href={existing.url} target="_blank" rel="noreferrer" className="ml-2 text-accent underline">
                view
              </a>
            )}
          </p>
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={async e => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true);
            await onUpload(f);
            setBusy(false);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="whitespace-nowrap rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm font-medium text-ink-800 hover:bg-cream-50 disabled:opacity-40"
        >
          {busy ? 'Uploading…' : existing ? 'Replace' : 'Upload'}
        </button>
      </div>
    </div>
  );
}
