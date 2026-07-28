'use client';

// Full-page view of one open role (InterviewConfig): the invite link with its
// open/closed toggle on top, then every candidate session for THIS role —
// verdict, summary, hard-check notes, their questions for Rhea, transcript.
// Operator-only (same gating pattern as TaskDetail).

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
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

export function InterviewJobDetail({ jobId }: { jobId: string }) {
  const { user, signIn } = useAuth();
  const authedFetch = useAuthedFetch();
  const [config, setConfig] = useState<InterviewConfig | null | 'missing'>(null);
  const [sessions, setSessions] = useState<InterviewSession[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [catchingUp, setCatchingUp] = useState(false);
  const [presenter, setPresenter] = useState(false);
  // Preview — a sample transcript showing what Rhai will actually ask.
  const [preview, setPreview] = useState<{ role: 'rhai' | 'candidate'; text: string }[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  // Scheduling link (booking page) — persisted on the role.
  const [schedLink, setSchedLink] = useState('');
  const [linkSaved, setLinkSaved] = useState(false);

  const load = useCallback(async () => {
    const res = await authedFetch('/api/rhai/interviews');
    if (!res.ok) return;
    const d = (await res.json()) as { configs: InterviewConfig[]; sessions: InterviewSession[] };
    const c = d.configs.find(x => x.id === jobId);
    setConfig(c ?? 'missing');
    if (c?.schedulingLink) setSchedLink(prev => prev || c.schedulingLink || '');
    setSessions(d.sessions.filter(s => s.interviewId === jobId));
  }, [authedFetch, jobId]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      await load();
      // Self-heal: summarise any interview that finished or got 8+ questions in
      // but was never evaluated. No model calls when nothing qualifies.
      try {
        setCatchingUp(true);
        const res = await authedFetch('/api/rhai/interviews', {
          method: 'POST',
          body: JSON.stringify({ action: 'backfill' })
        });
        if (res.ok && ((await res.json()) as { generated: number }).generated > 0) await load();
      } catch {
        // ignore — summaries just won't backfill this pass
      } finally {
        setCatchingUp(false);
      }
    })().catch(() => undefined);
  }, [user, load, authedFetch]);

  if (!user) {
    return (
      <Shell>
        <p className="text-sm text-ink-700">Sign in with the operator account to view this role.</p>
        <button
          type="button"
          onClick={() => signIn().catch(() => undefined)}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
        >
          Sign in with Google
        </button>
      </Shell>
    );
  }
  if (config === 'missing')
    return (
      <Shell>
        <p className="text-sm text-ink-500">This role doesn&apos;t exist (or was deleted).</p>
        <Link href="/leads" className="mt-3 inline-block text-sm text-accent hover:underline">
          ← Back to Rhai
        </Link>
      </Shell>
    );
  if (!config || sessions === null)
    return (
      <Shell>
        <p className="text-sm text-ink-400">Loading…</p>
      </Shell>
    );

  const toggleActive = async () => {
    const active = !config.active;
    setConfig({ ...config, active });
    await authedFetch('/api/rhai/interviews', {
      method: 'PATCH',
      body: JSON.stringify({ id: config.id, active })
    }).catch(() => undefined);
  };

  const runPreview = async () => {
    setPreviewing(true);
    setPreviewError(null);
    try {
      const res = await authedFetch('/api/rhai/interviews', {
        method: 'POST',
        body: JSON.stringify({ action: 'preview', id: config.id })
      });
      if (!res.ok) {
        setPreviewError((await res.text()) || 'Could not generate a preview.');
        return;
      }
      const { transcript } = (await res.json()) as { transcript: { role: 'rhai' | 'candidate'; text: string }[] };
      setPreview(transcript);
    } catch {
      setPreviewError('Network error — please try again.');
    } finally {
      setPreviewing(false);
    }
  };

  const saveSchedLink = async (link: string) => {
    setConfig({ ...config, schedulingLink: link });
    await authedFetch('/api/rhai/interviews', {
      method: 'POST',
      body: JSON.stringify({ action: 'scheduling-link', id: config.id, link })
    }).catch(() => undefined);
    setLinkSaved(true);
    setTimeout(() => setLinkSaved(false), 2000);
  };

  // Optimistically move a candidate between hiring stages.
  const setStage = async (sessionId: string, stage: InterviewSession['stage'] | null) => {
    setSessions(prev => (prev ? prev.map(s => (s.id === sessionId ? { ...s, stage: stage ?? undefined } : s)) : prev));
    await authedFetch('/api/rhai/interviews', {
      method: 'POST',
      body: JSON.stringify({ action: 'shortlist', sessionId, stage })
    }).catch(() => undefined);
  };

  const share = () => {
    navigator.clipboard.writeText(`${window.location.origin}/interview/${config.id}`).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const completed = sessions.filter(s => s.status === 'completed').length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/leads" className="text-xs text-ink-400 hover:text-ink-700">
        ← Rhai · Interviews
      </Link>

      {/* role header */}
      <div className="mt-3 rounded-lg border border-ink-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Open role</p>
            <h1 className="mt-1 font-display text-2xl tracking-tight text-ink-900">{config.title}</h1>
            <p className="mt-0.5 text-[11px] text-ink-400">/interview/{config.id}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={runPreview}
              disabled={previewing}
              className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              title="See a sample transcript of what Rhai will ask candidates for this role"
            >
              {previewing ? 'Generating…' : preview ? '↻ Re-run preview' : '▷ Preview interview'}
            </button>
            <button
              type="button"
              onClick={share}
              className="rounded-md border border-ink-200 px-3 py-1 text-xs text-ink-700 hover:bg-ink-50"
            >
              {copied ? '✓ Copied' : 'Copy share link'}
            </button>
            <button
              type="button"
              onClick={toggleActive}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                config.active
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
              }`}
            >
              {config.active ? '● Accepting' : '○ Closed'}
            </button>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-ink-400">
          {sessions.length} application{sessions.length === 1 ? '' : 's'} · {completed} completed
          {config.createdAt > 0 && (
            <> · created {new Date(config.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>
          )}
        </p>
      </div>

      {/* preview — what Rhai will actually ask, before you share the link */}
      {previewError && <p className="mt-3 text-xs text-rose-600">{previewError}</p>}
      {preview && (
        <section className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="eyebrow text-indigo-700">Sample interview · what Rhai plans to say</p>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="text-[11px] text-ink-400 hover:text-ink-700"
            >
              Hide
            </button>
          </div>
          <p className="mb-3 text-[11px] text-ink-500">
            An illustrative run with an invented candidate — it shows the flow and questions, not a real applicant. Edit
            the role in code if you want to change how Rhai runs it.
          </p>
          <div className="space-y-2">
            {preview.map((m, i) => (
              <div key={i} className={m.role === 'candidate' ? 'flex flex-col items-end' : 'flex flex-col items-start'}>
                <span className="mb-0.5 text-[9px] uppercase tracking-wider text-ink-400">
                  {m.role === 'candidate' ? 'Candidate (sample)' : 'Rhai'}
                </span>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-md px-3 py-2 text-xs leading-relaxed ${
                    m.role === 'candidate' ? 'bg-ink-900 text-cream' : 'bg-white text-ink-700 border border-indigo-100'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* shortlist → schedule: email everyone you've shortlisted a booking link */}
      <ScheduleBar
        role={config.title}
        shortlisted={sessions.filter(s => s.stage === 'shortlisted')}
        invited={sessions.filter(s => s.stage === 'invited')}
        link={schedLink}
        setLink={setSchedLink}
        onSaveLink={saveSchedLink}
        linkSaved={linkSaved}
        onMarkInvited={ids => ids.forEach(id => setStage(id, 'invited'))}
      />

      {/* candidates */}
      <section className="mt-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">
            Candidates · {sessions.length}
            {catchingUp && <span className="ml-2 normal-case tracking-normal text-ink-400">· catching up on summaries…</span>}
          </p>
          <button
            type="button"
            onClick={() => setPresenter(p => !p)}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
              presenter
                ? 'border-accent bg-accent text-white'
                : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
            }`}
            title="Blur names + contacts so you can show this as a demo"
          >
            {presenter ? '● Presenter mode — names hidden' : '○ Presenter mode'}
          </button>
        </div>
        {sessions.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
            No interviews yet — share the link and they&apos;ll appear here as they come in.
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <SessionCard key={s.id} s={s} presenter={presenter} onSetStage={setStage} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl px-6 py-16">{children}</div>;
}

// Shortlist → schedule. Rhea shortlists candidates on their cards; they collect
// here. She pastes her booking link once (saved on the role), then composes one
// email — BCC'd to everyone shortlisted — that opens in her own mail client for
// review and send. We never send on her behalf; she stays in the loop, and the
// booking link is hers so there's nothing to leak.
function ScheduleBar({
  role,
  shortlisted,
  invited,
  link,
  setLink,
  onSaveLink,
  linkSaved,
  onMarkInvited
}: {
  role: string;
  shortlisted: InterviewSession[];
  invited: InterviewSession[];
  link: string;
  setLink: (v: string) => void;
  onSaveLink: (link: string) => void;
  linkSaved: boolean;
  onMarkInvited: (ids: string[]) => void;
}) {
  const emails = shortlisted.map(s => s.candidate.email).filter(Boolean);
  const linkReady = /^https?:\/\//i.test(link.trim());

  const mailtoHref = () => {
    const subject = `Next step: interview for ${role}`;
    const body = [
      `Hi,`,
      ``,
      `Thanks so much for taking the time to talk to Rhai for the ${role} role — I really enjoyed going through your conversation and I'd love to take the next step with a short call.`,
      ``,
      `Please grab whichever slot works best for you here:`,
      link.trim(),
      ``,
      `Looking forward to speaking properly.`,
      ``,
      `Best,`,
      `Rhea`
    ].join('\n');
    return `mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  };

  return (
    <section className="mt-6 rounded-lg border border-accent/30 bg-accent/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow text-accent">Shortlist → schedule interviews</p>
        <p className="text-[11px] text-ink-500">
          {shortlisted.length} shortlisted
          {invited.length > 0 && ` · ${invited.length} invited`}
        </p>
      </div>

      {/* booking link — pasted once, saved on the role */}
      <label className="mt-3 block text-[11px] font-medium text-ink-600">
        Your scheduling / booking link (candidates pick a slot here)
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <input
          type="url"
          value={link}
          onChange={e => setLink(e.target.value)}
          placeholder="https://calendar.app.google/…  or any booking link"
          className="min-w-0 flex-1 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onSaveLink(link.trim())}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
        >
          {linkSaved ? '✓ Saved' : 'Save link'}
        </button>
      </div>

      {/* actions */}
      {shortlisted.length === 0 ? (
        <p className="mt-3 text-[11px] text-ink-500">
          Shortlist candidates below (☆ Shortlist) and they&apos;ll gather here to invite in one go.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={linkReady ? mailtoHref() : undefined}
            aria-disabled={!linkReady}
            onClick={e => {
              if (!linkReady) e.preventDefault();
            }}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              linkReady
                ? 'bg-accent text-white hover:bg-accent-600'
                : 'cursor-not-allowed bg-ink-100 text-ink-400'
            }`}
            title={linkReady ? 'Opens a draft in your mail client, BCC’d to all shortlisted' : 'Add a booking link first'}
          >
            ✉ Compose invite to {shortlisted.length} candidate{shortlisted.length === 1 ? '' : 's'}
          </a>
          <button
            type="button"
            onClick={() => onMarkInvited(shortlisted.map(s => s.id))}
            className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
          >
            Mark all as invited
          </button>
          {!linkReady && <span className="text-[11px] text-ink-500">Add a booking link to compose the email.</span>}
        </div>
      )}
      {shortlisted.length > 0 && (
        <p className="mt-2 text-[11px] text-ink-400">
          Opens a pre-written draft (BCC: {emails.length} candidate{emails.length === 1 ? '' : 's'}) in your own email
          app — review and send it yourself. Then &ldquo;Mark all as invited&rdquo; to track who&apos;s been reached.
        </p>
      )}
    </section>
  );
}

// Presenter mode — blur structured PII (name/contacts) and redact identity
// (name, email, phone) out of free text + the transcript, so the page can be
// shown as a live demo without exposing real candidates.
function Blur({ on, children }: { on: boolean; children: React.ReactNode }) {
  return on ? <span className="select-none blur-[5px]">{children}</span> : <>{children}</>;
}
function redact(text: string, name: string, on: boolean): string {
  if (!on || !text) return text;
  let out = text;
  const parts = [name, ...name.split(/\s+/)].filter(t => t && t.length >= 3);
  for (const t of parts) {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    out = out.replace(re, '•••');
  }
  out = out.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '•••');
  out = out.replace(/\+?\d[\d\s().-]{6,}\d/g, '•••');
  return out;
}

function SessionCard({
  s,
  presenter,
  onSetStage
}: {
  s: InterviewSession;
  presenter: boolean;
  onSetStage: (sessionId: string, stage: InterviewSession['stage'] | null) => void;
}) {
  const [showTranscript, setShowTranscript] = useState(false);
  const done = s.status === 'completed';
  const name = s.candidate.name;
  const rd = (t?: string) => redact(t ?? '', name, presenter);
  return (
    <div
      className={`rounded-lg border bg-white p-4 ${
        s.stage === 'shortlisted'
          ? 'border-accent/50 ring-1 ring-accent/20'
          : s.stage === 'invited'
            ? 'border-emerald-200'
            : 'border-ink-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink-900"><Blur on={presenter}>{s.candidate.name}</Blur></p>
            {done && s.summary ? (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${VERDICT_CHIP[s.summary.verdict]}`}>
                {VERDICT_LABEL[s.summary.verdict]}
              </span>
            ) : (
              <span className="rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[10px] text-ink-500">
                {done ? 'completed' : 'in progress'}
              </span>
            )}
            {s.stage === 'shortlisted' && (
              <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                ★ Shortlisted
              </span>
            )}
            {s.stage === 'invited' && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                ✓ Invited to interview
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-ink-500">
            <Blur on={presenter}>{s.candidate.email} · {s.candidate.phone}</Blur>
          </p>
          {s.candidate.applyType && (
            <p className="mt-0.5 text-[11px] text-ink-400">
              via {s.candidate.applyType}
              {s.candidate.applyType === 'Agency' && s.candidate.agencyName ? ` — ${s.candidate.agencyName}` : ''}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <p className="text-[10px] text-ink-400">
            {new Date(s.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
          {/* Shortlist toggle — moves the candidate into the schedule bar above. */}
          {s.stage === 'invited' ? (
            <button
              type="button"
              onClick={() => onSetStage(s.id, 'shortlisted')}
              className="rounded-md border border-ink-200 px-2.5 py-1 text-[11px] text-ink-500 hover:bg-ink-50"
            >
              ↩ Back to shortlist
            </button>
          ) : s.stage === 'shortlisted' ? (
            <button
              type="button"
              onClick={() => onSetStage(s.id, null)}
              className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-accent/20"
            >
              ★ Shortlisted — remove
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSetStage(s.id, 'shortlisted')}
              className="rounded-md border border-ink-200 px-2.5 py-1 text-[11px] font-medium text-ink-700 hover:border-accent hover:bg-accent/5 hover:text-accent"
            >
              ☆ Shortlist
            </button>
          )}
        </div>
      </div>

      {/* CV / resume — surfaced prominently in the feedback area so it's easy
          to pull up while reviewing, not buried in the contact line. Hidden in
          presenter mode (it's a link to the candidate's real document). */}
      {s.candidate.resumeUrl && !presenter && (
        <a
          href={s.candidate.resumeUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
        >
          📄 View CV{s.candidate.resumeName ? ` — ${s.candidate.resumeName}` : ''}
        </a>
      )}

      {s.summary && (
        <div className="mt-3 rounded-md border border-ink-100 bg-cream-50/60 p-3">
          <p className="text-xs leading-relaxed text-ink-700">{rd(s.summary.summary)}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {s.summary.strengths.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Strengths</p>
                <ul className="mt-0.5 list-disc pl-4 text-[11px] text-ink-700">
                  {s.summary.strengths.map((x, i) => (
                    <li key={i}>{rd(x)}</li>
                  ))}
                </ul>
              </div>
            )}
            {s.summary.concerns.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">Concerns</p>
                <ul className="mt-0.5 list-disc pl-4 text-[11px] text-ink-700">
                  {s.summary.concerns.map((x, i) => (
                    <li key={i}>{rd(x)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {s.summary.hardCheckNotes && (
            <p className="mt-2 text-[11px] text-ink-600">
              <span className="font-semibold">Hard checks:</span> {rd(s.summary.hardCheckNotes)}
            </p>
          )}
        </div>
      )}

      {s.questionsForRhea && (
        <div className="mt-2 rounded-md border border-indigo-100 bg-indigo-50/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700">Their questions for you</p>
          <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink-700">{rd(s.questionsForRhea)}</p>
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
                {rd(m.text)}
              </div>
              {m.audioUrl && !presenter && (
                <audio controls preload="none" src={m.audioUrl} className="h-7 max-w-[85%]" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
