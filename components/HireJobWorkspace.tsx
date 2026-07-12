'use client';

// One role's workspace: the interview script (edit / add / delete / reorder,
// with a chat rail to co-design it with Rhai), publish + share link, payment
// gates (job fee + application tiers via Razorpay), and applications ranked
// by fit with filters.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useAuthedFetch } from './useAuthedFetch';
import { openRazorpay } from '@/lib/hire/razorpay-client';
import {
  FIT_META,
  QUESTION_KIND_LABELS,
  TIER_LIMITS,
  type HireApplication,
  type HireJob,
  type HirePricingBase,
  type HireQuestion
} from '@/lib/hire/types';

export function HireJobWorkspace({ jobId }: { jobId: string }) {
  const { user, signIn } = useAuth();
  const authedFetch = useAuthedFetch();
  const [job, setJob] = useState<HireJob | null>(null);
  const [pricing, setPricing] = useState<HirePricingBase | null>(null);
  const [tab, setTab] = useState<'script' | 'applications'>('script');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authedFetch(`/api/hire/jobs/${jobId}`);
    if (res.ok) {
      const d = (await res.json()) as { job: HireJob; pricing: HirePricingBase };
      setJob(d.job);
      setPricing(d.pricing);
    } else setErr(res.status === 403 ? 'This role belongs to another account.' : 'Could not load this role.');
  }, [authedFetch, jobId]);

  useEffect(() => {
    if (user) load().catch(() => undefined);
  }, [user, load]);

  if (!user)
    return (
      <Shell>
        <p className="text-sm text-ink-700">Sign in to manage this role.</p>
        <button type="button" onClick={() => signIn().catch(() => undefined)} className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600">
          Sign in with Google
        </button>
      </Shell>
    );
  if (err) return <Shell><p className="text-sm text-rose-600">{err}</p></Shell>;
  if (!job || !pricing) return <Shell><p className="text-sm text-ink-400">Loading…</p></Shell>;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/hire" className="text-xs text-ink-400 hover:text-ink-700">← All roles</Link>
      <Header job={job} pricing={pricing} authedFetch={authedFetch} onChange={setJob} userEmail={user.email ?? undefined} />

      <div className="mt-5 flex gap-1 border-b border-ink-200/70">
        {(['script', 'applications'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t ? 'border-accent text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-800'
            }`}
          >
            {t === 'script' ? 'Interview script' : `Applications · ${job.applicationsCount}`}
          </button>
        ))}
      </div>

      {tab === 'script' ? (
        <ScriptEditor job={job} authedFetch={authedFetch} onChange={setJob} />
      ) : (
        <Applications jobId={jobId} authedFetch={authedFetch} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header: status, share link, publish + payment gates
// ---------------------------------------------------------------------------

function Header({
  job,
  pricing,
  authedFetch,
  onChange,
  userEmail
}: {
  job: HireJob;
  pricing: HirePricingBase;
  authedFetch: (p: string, i?: RequestInit) => Promise<Response>;
  onChange: (j: HireJob) => void;
  userEmail?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const applyUrl = typeof window !== 'undefined' ? `${window.location.origin}/apply/${job.id}` : `/apply/${job.id}`;
  const cap = job.applicationTier === 'tier2' ? Infinity : job.applicationTier === 'tier1' ? TIER_LIMITS.tier1 : pricing.freeApplications;
  const atCapacity = job.applicationsCount >= cap;

  const pay = async (kind: 'job' | 'tier1' | 'tier2') => {
    setNotice(null);
    setBusy(true);
    try {
      const res = await authedFetch('/api/hire/payments', { method: 'POST', body: JSON.stringify({ kind, jobId: job.id }) });
      if (!res.ok) {
        setNotice(await res.text());
        return;
      }
      const d = (await res.json()) as { orderId: string; amountInr: number; keyId: string };
      const label = kind === 'job' ? 'Activate role' : kind === 'tier1' ? 'Up to 50 applications' : 'Unlimited applications';
      const result = await openRazorpay({ keyId: d.keyId, orderId: d.orderId, amountInr: d.amountInr, label, email: userEmail });
      if (!result) {
        setNotice('Payment was not completed.');
        return;
      }
      const verify = await authedFetch('/api/hire/payments', {
        method: 'PUT',
        body: JSON.stringify({ kind, jobId: job.id, ...result })
      });
      if (!verify.ok) {
        setNotice('Payment verification failed — contact rhea@rosebazaar.in with your payment id.');
        return;
      }
      if (kind === 'job') onChange({ ...job, paidJob: true, paidVia: 'razorpay' });
      else onChange({ ...job, applicationTier: kind });
      setNotice('✓ Payment received.');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: HireJob['status']) => {
    setNotice(null);
    setBusy(true);
    try {
      const res = await authedFetch(`/api/hire/jobs/${job.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      if (res.status === 402) {
        const t = await res.text();
        const price = t.split(':')[1] ?? pricing.jobPrice;
        setNotice(`This role is beyond your free allowance — activate it for ₹${price}.`);
        return;
      }
      if (!res.ok) {
        setNotice(await res.text());
        return;
      }
      const d = (await res.json()) as { job: HireJob };
      onChange({ ...job, ...d.job });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl tracking-tight text-ink-900">{job.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {job.status === 'open' && (
            <>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(applyUrl).catch(() => undefined);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="rounded-md border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
              >
                {copied ? '✓ Copied' : 'Copy application link'}
              </button>
              <button type="button" onClick={() => setStatus('closed')} disabled={busy} className="rounded-md border border-ink-200 px-3 py-1.5 text-xs text-ink-500 hover:bg-ink-50">
                Close role
              </button>
            </>
          )}
          {job.status !== 'open' && (
            <button
              type="button"
              onClick={() => setStatus('open')}
              disabled={busy}
              className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {job.status === 'draft' ? '● Publish — start accepting applications' : 'Reopen'}
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-[11px] text-ink-400">
        {job.status === 'open' ? (
          <>Live at <span className="font-mono text-ink-600">{applyUrl}</span></>
        ) : (
          `Status: ${job.status}`
        )}
        {' · '}
        {job.applicationsCount} / {cap === Infinity ? '∞' : cap} applications used
      </p>

      {notice && <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{notice}</p>}

      {/* Payment gates */}
      {!job.paidJob && job.status === 'draft' && (
        <Banner>
          Publishing may need activation (your first {pricing.freeJobs} job{pricing.freeJobs === 1 ? ' is' : 's are'} free).
          If asked, activate for <b>₹{pricing.jobPrice.toLocaleString('en-IN')}</b>.{' '}
          <PayBtn onClick={() => pay('job')} disabled={busy}>Activate now</PayBtn>
        </Banner>
      )}
      {job.applicationTier === 'free' && (atCapacity || job.applicationsCount >= Math.max(1, pricing.freeApplications - 2)) && (
        <Banner>
          {atCapacity ? 'You’ve hit the free application limit — new candidates are paused.' : `Approaching the free limit of ${pricing.freeApplications}.`}{' '}
          Unlock up to 50 for <b>₹{pricing.tier1Price.toLocaleString('en-IN')}</b>{' '}
          <PayBtn onClick={() => pay('tier1')} disabled={busy}>Unlock 50</PayBtn>{' '}
          or unlimited for <b>₹{pricing.tier2Price.toLocaleString('en-IN')}</b>{' '}
          <PayBtn onClick={() => pay('tier2')} disabled={busy}>Go unlimited</PayBtn>
        </Banner>
      )}
      {job.applicationTier === 'tier1' && job.applicationsCount >= 45 && (
        <Banner>
          Approaching 50 applications. Go unlimited for <b>₹{pricing.tier2Price.toLocaleString('en-IN')}</b>{' '}
          <PayBtn onClick={() => pay('tier2')} disabled={busy}>Go unlimited</PayBtn>
        </Banner>
      )}
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 rounded-md border border-accent/30 bg-accent-soft/40 px-3 py-2 text-xs text-ink-800">{children}</div>;
}
function PayBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-white hover:bg-accent-600 disabled:opacity-50">
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Script editor + Rhai chat rail
// ---------------------------------------------------------------------------

function ScriptEditor({
  job,
  authedFetch,
  onChange
}: {
  job: HireJob;
  authedFetch: (p: string, i?: RequestInit) => Promise<Response>;
  onChange: (j: HireJob) => void;
}) {
  const [saving, setSaving] = useState(false);

  const saveQuestions = async (questions: HireQuestion[]) => {
    onChange({ ...job, questions });
    setSaving(true);
    try {
      await authedFetch(`/api/hire/jobs/${job.id}`, { method: 'PATCH', body: JSON.stringify({ questions }) });
    } finally {
      setSaving(false);
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= job.questions.length) return;
    const next = [...job.questions];
    [next[i], next[j]] = [next[j], next[i]];
    saveQuestions(next);
  };

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
      <div>
        {job.gaps && job.gaps.length > 0 && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">Rhai needs from you</p>
            <ul className="mt-1 list-disc pl-5 text-xs text-amber-900">
              {job.gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-amber-700">Answer in the chat → Rhai folds it into the interview.</p>
          </div>
        )}

        <div className="mb-2 flex items-center justify-between">
          <p className="eyebrow">The script · {job.questions.length} questions {saving && <span className="text-ink-300">· saving…</span>}</p>
          <button
            type="button"
            onClick={() =>
              saveQuestions([
                ...job.questions,
                { id: `q${Date.now()}`, text: 'New question — click to edit', kind: 'experience' }
              ])
            }
            className="rounded-md border border-ink-200 px-2.5 py-1 text-xs text-ink-600 hover:bg-ink-50"
          >
            + Add question
          </button>
        </div>

        <ol className="space-y-2">
          {job.questions.map((q, i) => (
            <QuestionRow
              key={q.id}
              q={q}
              index={i}
              total={job.questions.length}
              onMove={dir => move(i, dir)}
              onSave={next => saveQuestions(job.questions.map((x, xi) => (xi === i ? next : x)))}
              onDelete={() => saveQuestions(job.questions.filter((_, xi) => xi !== i))}
            />
          ))}
        </ol>
      </div>

      <ScriptChat job={job} authedFetch={authedFetch} onChange={onChange} />
    </div>
  );
}

function QuestionRow({
  q,
  index,
  total,
  onMove,
  onSave,
  onDelete
}: {
  q: HireQuestion;
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  onSave: (q: HireQuestion) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(q.text);

  return (
    <li className="rounded-lg border border-ink-200 bg-white p-3">
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="text-ink-300 hover:text-ink-700 disabled:opacity-30" title="Move up">▲</button>
          <span className="font-display text-sm text-accent">{index + 1}</span>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="text-ink-300 hover:text-ink-700 disabled:opacity-30" title="Move down">▼</button>
        </div>
        <div className="min-w-0 flex-1">
          <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-500">
            {QUESTION_KIND_LABELS[q.kind]}
          </span>
          {editing ? (
            <div className="mt-1.5">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-ink-200 px-2.5 py-1.5 text-sm focus:border-ink-400 focus:outline-none"
              />
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (text.trim().length > 5) onSave({ ...q, text: text.trim() });
                    setEditing(false);
                  }}
                  className="rounded bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:bg-accent-600"
                >
                  Save
                </button>
                <button type="button" onClick={() => { setText(q.text); setEditing(false); }} className="text-[11px] text-ink-400 hover:underline">
                  cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 cursor-pointer text-sm leading-relaxed text-ink-900" onClick={() => setEditing(true)} title="Click to edit">
              {q.text}
            </p>
          )}
          {q.purpose && <p className="mt-0.5 text-[11px] italic text-ink-400">probes: {q.purpose}</p>}
        </div>
        <button type="button" onClick={onDelete} className="shrink-0 text-xs text-ink-300 hover:text-rose-600" title="Delete">✕</button>
      </div>
    </li>
  );
}

function ScriptChat({
  job,
  authedFetch,
  onChange
}: {
  job: HireJob;
  authedFetch: (p: string, i?: RequestInit) => Promise<Response>;
  onChange: (j: HireJob) => void;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chat = job.chat ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.length, sending]);

  const send = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setDraft('');
    setSending(true);
    const now = Date.now();
    onChange({ ...job, chat: [...chat, { role: 'user', text: message, at: now }] });
    try {
      const res = await authedFetch(`/api/hire/jobs/${job.id}/chat`, { method: 'POST', body: JSON.stringify({ message }) });
      if (!res.ok) {
        onChange({ ...job, chat: [...chat, { role: 'user', text: message, at: now }, { role: 'rhai', text: 'Something went wrong — try again.', at: Date.now() }] });
        return;
      }
      const d = (await res.json()) as { reply: string; questions: HireQuestion[] | null; gaps: string[] | null };
      onChange({
        ...job,
        questions: d.questions ?? job.questions,
        gaps: d.gaps ?? job.gaps,
        chat: [...chat, { role: 'user', text: message, at: now }, { role: 'rhai', text: d.reply, at: Date.now() }]
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[70vh] flex-col overflow-hidden rounded-lg border border-ink-200 bg-white lg:sticky lg:top-4">
      <div className="border-b border-ink-100 bg-cream-50 px-4 py-2.5">
        <p className="eyebrow">Design it with Rhai</p>
        <p className="text-[11px] text-ink-500">“Add a question on X”, “make it shorter”, or answer Rhai&apos;s questions — the script updates live.</p>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {chat.length === 0 && (
          <p className="px-1 text-[11px] leading-relaxed text-ink-400">
            Try: “add a question about handling difficult clients” · “too long, cut to 10 questions” · “the salary band is 12–15 LPA” (Rhai remembers it for candidates who ask).
          </p>
        )}
        {chat.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[12px] leading-relaxed ${m.role === 'user' ? 'bg-ink-900 text-cream' : 'border border-ink-200 bg-cream-50 text-ink-800'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {sending && <p className="px-1 text-[11px] text-ink-400">Rhai is thinking…</p>}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-ink-100 p-2.5">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="Refine the interview with Rhai…"
            className="flex-1 resize-none rounded-md border border-ink-200 px-2.5 py-1.5 text-[12px] leading-relaxed focus:border-ink-400 focus:outline-none"
          />
          <button type="button" onClick={send} disabled={sending || !draft.trim()} className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-600 disabled:opacity-50">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Applications: ranked, filtered, transcript viewer, reject
// ---------------------------------------------------------------------------

type AppFilter = 'all' | 'strong' | 'possible' | 'weak' | 'rejected' | 'incomplete';

function Applications({ jobId, authedFetch }: { jobId: string; authedFetch: (p: string, i?: RequestInit) => Promise<Response> }) {
  const [apps, setApps] = useState<(HireApplication & { messageCount?: number })[] | null>(null);
  const [filter, setFilter] = useState<AppFilter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authedFetch(`/api/hire/jobs/${jobId}/applications`);
    if (res.ok) setApps(((await res.json()) as { applications: HireApplication[] }).applications);
  }, [authedFetch, jobId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  if (apps === null) return <p className="mt-5 text-sm text-ink-400">Loading…</p>;

  const match = (a: HireApplication): boolean => {
    if (filter === 'all') return !a.rejected;
    if (filter === 'rejected') return !!a.rejected;
    if (filter === 'incomplete') return a.status !== 'completed' && !a.rejected;
    return a.status === 'completed' && a.fit?.verdict === filter && !a.rejected;
  };
  const shown = apps.filter(match);
  const count = (f: AppFilter) =>
    apps.filter(a =>
      f === 'all' ? !a.rejected : f === 'rejected' ? !!a.rejected : f === 'incomplete' ? a.status !== 'completed' && !a.rejected : a.status === 'completed' && a.fit?.verdict === f && !a.rejected
    ).length;

  const setRejected = async (id: string, rejected: boolean) => {
    setApps(prev => (prev ? prev.map(a => (a.id === id ? { ...a, rejected } : a)) : prev));
    await authedFetch(`/api/hire/jobs/${jobId}/applications`, { method: 'PATCH', body: JSON.stringify({ applicationId: id, rejected }) }).catch(() => undefined);
  };

  const FILTERS: { id: AppFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'strong', label: 'Strong' },
    { id: 'possible', label: 'Possible' },
    { id: 'weak', label: 'Weak' },
    { id: 'incomplete', label: 'Incomplete' },
    { id: 'rejected', label: 'Rejected' }
  ];

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1 text-xs ${
              filter === f.id ? 'bg-ink-900 text-cream' : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
            }`}
          >
            {f.label} · {count(f.id)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
          {apps.length === 0 ? 'No applications yet — share the link and they’ll appear here, ranked by fit.' : 'Nothing matches this filter.'}
        </p>
      ) : (
        <div className="space-y-2">
          {shown.map(a => (
            <div key={a.id} className="rounded-lg border border-ink-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink-900">{a.candidate.name}</p>
                    {a.status === 'completed' && a.fit ? (
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${FIT_META[a.fit.verdict].chip}`}>
                        {FIT_META[a.fit.verdict].label} · {a.fit.score}
                      </span>
                    ) : (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                        Incomplete
                      </span>
                    )}
                    {a.rejected && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] text-ink-500">Rejected</span>}
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-500">
                    <a href={`mailto:${a.candidate.email}`} className="text-indigo-600 hover:underline">{a.candidate.email}</a> · {a.candidate.phone}
                    {a.candidate.resumeUrl && (
                      <> · <a href={a.candidate.resumeUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">resume ↗</a></>
                    )}
                  </p>
                </div>
                <p className="text-[10px] text-ink-400">
                  {new Date(a.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {a.fit && (
                <div className="mt-2 rounded-md bg-cream-50 p-3 text-xs leading-relaxed text-ink-700">
                  <p>{a.fit.summary}</p>
                  {(a.fit.strengths.length > 0 || a.fit.concerns.length > 0) && (
                    <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
                      {a.fit.strengths.length > 0 && (
                        <p><span className="font-semibold text-emerald-700">+ </span>{a.fit.strengths.join(' · ')}</p>
                      )}
                      {a.fit.concerns.length > 0 && (
                        <p><span className="font-semibold text-rose-600">− </span>{a.fit.concerns.join(' · ')}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
                <button type="button" onClick={() => setOpenId(openId === a.id ? null : a.id)} className="text-indigo-600 hover:underline">
                  {openId === a.id ? 'Hide transcript' : 'Full transcript'}
                </button>
                {a.rejected ? (
                  <button type="button" onClick={() => setRejected(a.id, false)} className="text-ink-400 hover:underline">Un-reject</button>
                ) : (
                  <button type="button" onClick={() => setRejected(a.id, true)} className="text-rose-500 hover:underline">Reject</button>
                )}
              </div>

              {openId === a.id && <Transcript jobId={jobId} appId={a.id} authedFetch={authedFetch} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Transcript({ jobId, appId, authedFetch }: { jobId: string; appId: string; authedFetch: (p: string, i?: RequestInit) => Promise<Response> }) {
  const [app, setApp] = useState<HireApplication | null>(null);
  useEffect(() => {
    authedFetch(`/api/hire/jobs/${jobId}/applications/${appId}`)
      .then(async r => (r.ok ? setApp(((await r.json()) as { application: HireApplication }).application) : undefined))
      .catch(() => undefined);
  }, [authedFetch, jobId, appId]);
  if (!app) return <p className="mt-2 text-[11px] text-ink-400">Loading transcript…</p>;
  return (
    <div className="mt-2 max-h-96 space-y-2 overflow-y-auto rounded-md border border-ink-100 p-3">
      {app.messages.map((m, i) => (
        <div key={i} className={m.role === 'candidate' ? 'flex justify-end' : 'flex justify-start'}>
          <div className={`max-w-[85%] whitespace-pre-wrap rounded-md px-2.5 py-1.5 text-[11px] leading-relaxed ${m.role === 'candidate' ? 'bg-ink-900 text-cream' : 'bg-cream-50 text-ink-700'}`}>
            {m.text}
          </div>
        </div>
      ))}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl px-6 py-16">{children}</div>;
}
