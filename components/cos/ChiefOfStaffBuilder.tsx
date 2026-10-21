'use client';

// Build your Chief of Staff — the public workshop page. Five steps, each
// autosaved: About you → Design (a guided interview, text or voice) → Review
// (edit the spec + the compiled agent.md) → Connect (WhatsApp, Google) →
// Live (test console, export). Built for 150 people on phones with patchy
// data: small requests, server-side persistence after every turn, a local
// mirror of the form so a dropped connection never loses an answer.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCustomToken } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';
import { useAuthedFetch } from '@/components/useAuthedFetch';
import { useVoice } from '@/components/useVoice';
import { compileAgentMd, effectiveAgentMd } from '@/lib/cos/prompt';
import {
  COS_SECTIONS,
  SELF_BRIEF_PROMPT,
  allSectionsFilled,
  sectionFilled,
  type CosAgent,
  type CosMessage,
  type CosProfile,
  type CosSpec
} from '@/lib/cos/types';

const STEPS = ['About you', 'Design', 'Review', 'Connect', 'Live'] as const;
const LOCAL_KEY = 'cos_draft_v1';

interface Turn {
  role: 'user' | 'agent';
  text: string;
  at?: number;
}

export function ChiefOfStaffBuilder() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Shell>
        <p className="py-16 text-center text-sm text-ink-400">Loading…</p>
      </Shell>
    );
  }
  if (!user) return <Landing />;
  return <Builder uid={user.uid} email={user.email ?? ''} displayName={('displayName' in user ? user.displayName : null) ?? ''} />;
}

// ---------------------------------------------------------------------------
// Landing + sign in
// ---------------------------------------------------------------------------
function Landing() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // Finish a redirect-based sign-in (the fallback when popups are blocked).
    getRedirectResult(getClientAuth()).catch(() => undefined);
    // Local development only: `#ct=<custom token>` signs in a test user so the
    // whole flow can be driven without a Google popup. Compiled out of prod.
    if (process.env.NODE_ENV === 'development') {
      const m = /[#&]ct=([^&]+)/.exec(window.location.hash);
      if (m) signInWithCustomToken(getClientAuth(), decodeURIComponent(m[1])).catch(() => undefined);
    }
  }, []);

  const signIn = async () => {
    setBusy(true);
    setErr(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(getClientAuth(), provider);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(getClientAuth(), provider);
        return;
      }
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setErr('Sign-in did not go through — try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div className="rounded-lg border border-ink-200 bg-white p-6 sm:p-8">
        <p className="eyebrow">Rhai workshop</p>
        <h1 className="mt-2 font-display text-2xl tracking-tight text-ink-900 sm:text-3xl">
          Build your own chief of staff.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          A short interview, by voice or text, and you leave with an AI chief of staff that knows how you work. It meets
          you on WhatsApp. Connect your Google Calendar and Gmail and it starts working off your real week.
        </p>
        <ol className="mt-5 space-y-1.5 text-sm text-ink-700">
          {STEPS.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="w-4 text-right font-mono text-xs text-ink-400">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={signIn}
          disabled={busy}
          className="mt-6 w-full rounded-md bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60 sm:w-auto"
        >
          {busy ? 'Opening Google…' : 'Sign in with Google to start →'}
        </button>
        {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
        <SafetyNote className="mt-5" />
      </div>
    </Shell>
  );
}

function SafetyNote({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-md border border-ink-100 bg-cream-50 p-3 text-[12px] leading-relaxed text-ink-600 ${className}`}>
      <p className="font-medium text-ink-800">Your data stays yours.</p>
      <p className="mt-1">
        What you tell your chief of staff is stored under your own sign-in and read only by your agent when you message
        it. Google access is read-only for Gmail, and the tokens sit server-side where nobody — including Rhea — can
        open your inbox or calendar. Disconnect at any time from this page and the access is revoked at Google in the
        same click. Nothing is shared, sold, or used to train anything.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The builder (signed in)
// ---------------------------------------------------------------------------
function Builder({ uid, email, displayName }: { uid: string; email: string; displayName: string }) {
  const authedFetch = useAuthedFetch();
  const [agent, setAgent] = useState<CosAgent | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [waNumber, setWaNumber] = useState('');
  const [googleAvailable, setGoogleAvailable] = useState(true);
  const [step, setStep] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'offline'>('idle');
  const [toast, setToast] = useState<string | null>(null);

  // ---- load --------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch('/api/cos');
        if (!res.ok) throw new Error(await res.text());
        const d = (await res.json()) as { agent: CosAgent; whatsappNumber: string; googleAvailable: boolean };
        if (cancelled) return;
        let a = d.agent;
        // Local mirror: if the phone lost connection mid-form, the newer copy
        // lives in localStorage. Push it up and carry on from it.
        try {
          const raw = localStorage.getItem(`${LOCAL_KEY}:${uid}`);
          if (raw) {
            const local = JSON.parse(raw) as { at: number; profile: CosProfile; spec: CosSpec; step: number };
            if (local.at > a.updatedAt + 1500) {
              a = { ...a, profile: local.profile, spec: local.spec, step: local.step };
              void authedFetch('/api/cos', {
                method: 'PATCH',
                body: JSON.stringify({ profile: local.profile, spec: local.spec, step: local.step })
              });
            }
          }
        } catch {
          // storage unavailable — server copy is fine
        }
        if (!a.profile.name && displayName) {
          a = { ...a, profile: { ...a.profile, name: displayName } };
          void authedFetch('/api/cos', { method: 'PATCH', body: JSON.stringify({ profile: a.profile }) });
        }
        setAgent(a);
        setStep(a.step ?? 0);
        setWaNumber(d.whatsappNumber);
        setGoogleAvailable(d.googleAvailable);
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : 'Could not load');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedFetch, uid, displayName]);

  // Google OAuth bounce-back (?google=connected|error)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const g = p.get('google');
    if (!g) return;
    if (g === 'connected') setToast('Google connected. Your chief of staff can now see your calendar and inbox.');
    else setToast(`Google connection failed: ${p.get('why') ?? 'try again'}`);
    setStep(3);
    window.history.replaceState({}, '', window.location.pathname);
    // refresh the agent so the Google badge shows
    void authedFetch('/api/cos')
      .then(r => (r.ok ? r.json() : null))
      .then((d: { agent: CosAgent } | null) => d && setAgent(prev => (prev ? { ...prev, google: d.agent.google } : d.agent)));
  }, [authedFetch]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- autosave ----------------------------------------------------------
  const pendingRef = useRef<Partial<CosAgent>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const patch = pendingRef.current;
    pendingRef.current = {};
    if (!Object.keys(patch).length) return;
    setSaveState('saving');
    try {
      const res = await authedFetch('/api/cos', { method: 'PATCH', body: JSON.stringify(patch) });
      if (!res.ok) throw new Error('save failed');
      const d = (await res.json()) as { agent: CosAgent };
      setAgent(prev => (prev ? { ...prev, agentMd: d.agent.agentMd, updatedAt: d.agent.updatedAt, profile: { ...prev.profile, phoneDigits: d.agent.profile.phoneDigits } } : d.agent));
      setSaveState('saved');
    } catch {
      // keep the patch for the next attempt; the local mirror has it anyway
      pendingRef.current = { ...patch, ...pendingRef.current };
      setSaveState('offline');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), 5000);
    }
  }, [authedFetch]);

  const save = useCallback(
    (patch: Partial<CosAgent>) => {
      setAgent(prev => {
        if (!prev) return prev;
        const next = { ...prev, ...patch } as CosAgent;
        if (patch.spec) next.spec = { ...prev.spec, ...patch.spec, toolFlags: { ...prev.spec.toolFlags, ...(patch.spec.toolFlags ?? {}) } };
        if (patch.profile) next.profile = { ...prev.profile, ...patch.profile };
        if (!next.agentMdEdited) next.agentMd = compileAgentMd(next);
        try {
          localStorage.setItem(
            `${LOCAL_KEY}:${uid}`,
            JSON.stringify({ at: Date.now(), profile: next.profile, spec: next.spec, step: next.step })
          );
        } catch {
          // ignore
        }
        return next;
      });
      pendingRef.current = { ...pendingRef.current, ...patch };
      if (patch.spec) pendingRef.current.spec = { ...(pendingRef.current.spec ?? {}), ...patch.spec } as CosSpec;
      if (patch.profile) pendingRef.current.profile = { ...(pendingRef.current.profile ?? {}), ...patch.profile } as CosProfile;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), 700);
    },
    [flush, uid]
  );

  const goTo = useCallback(
    (n: number) => {
      setStep(n);
      save({ step: n });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [save]
  );

  if (loadErr) {
    return (
      <Shell>
        <p className="text-sm text-rose-600">Could not load your chief of staff: {loadErr}</p>
      </Shell>
    );
  }
  if (!agent) {
    return (
      <Shell>
        <p className="py-16 text-center text-sm text-ink-400">Opening your chief of staff…</p>
      </Shell>
    );
  }

  return (
    <Shell wide>
      <StepBar step={step} onPick={goTo} agent={agent} saveState={saveState} />
      {toast && (
        <div className="mb-4 rounded-md border border-ink-200 bg-white px-4 py-3 text-sm text-ink-800 shadow-sm">{toast}</div>
      )}
      {step === 0 && <AboutStep agent={agent} save={save} next={() => goTo(1)} />}
      {step === 1 && <DesignStep agent={agent} setAgent={setAgent} uid={uid} next={() => goTo(2)} back={() => goTo(0)} />}
      {step === 2 && <ReviewStep agent={agent} save={save} next={() => goTo(3)} back={() => goTo(1)} />}
      {step === 3 && (
        <ConnectStep
          agent={agent}
          setAgent={setAgent}
          waNumber={waNumber}
          googleAvailable={googleAvailable}
          email={email}
          next={() => goTo(4)}
          back={() => goTo(2)}
          setToast={setToast}
        />
      )}
      {step === 4 && <LiveStep agent={agent} waNumber={waNumber} goTo={goTo} />}
    </Shell>
  );
}

function StepBar({
  step,
  onPick,
  agent,
  saveState
}: {
  step: number;
  onPick: (n: number) => void;
  agent: CosAgent;
  saveState: 'idle' | 'saving' | 'saved' | 'offline';
}) {
  const doneUpTo = useMemo(() => {
    let n = 0;
    if (agent.profile.name && agent.profile.phone) n = 1;
    if (n >= 1 && allSectionsFilled(agent.spec)) n = 2;
    if (n >= 2 && agent.status === 'live') n = 4;
    return n;
  }, [agent]);
  return (
    <div className="mb-5">
      <div className="no-scrollbar flex gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const active = i === step;
          const done = i < doneUpTo;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onPick(i)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                active
                  ? 'border-ink-900 bg-ink-900 text-cream'
                  : done
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-ink-200 bg-white text-ink-600'
              }`}
            >
              {i + 1}. {s}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 h-4 text-[11px] text-ink-400">
        {saveState === 'saving' && 'Saving…'}
        {saveState === 'saved' && 'Saved'}
        {saveState === 'offline' && 'No connection — kept on this phone, will save when back online'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — About you
// ---------------------------------------------------------------------------
function AboutStep({ agent, save, next }: { agent: CosAgent; save: (p: Partial<CosAgent>) => void; next: () => void }) {
  const p = agent.profile;
  const [linksText, setLinksText] = useState(p.links.join('\n'));
  const [copied, setCopied] = useState(false);
  const voice = useVoice(t => save({ profile: { ...p, bio: p.bio ? p.bio + ' ' + t : t } }));
  const ready = p.name.trim().length >= 2 && p.phone.replace(/\D/g, '').length >= 10;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(SELF_BRIEF_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — the prompt is visible to select
    }
  };

  return (
    <Card>
      <p className="eyebrow">Step 1</p>
      <h2 className="mt-1 font-display text-xl text-ink-900 sm:text-2xl">About you</h2>
      <p className="mt-2 text-sm text-ink-600">The number is how your chief of staff finds you on WhatsApp. The rest is what it knows on day one.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow">Your name</span>
          <input
            value={p.name}
            onChange={e => save({ profile: { ...p, name: e.target.value } })}
            className={inputCls}
            placeholder="Full name"
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="eyebrow">WhatsApp number</span>
          <input
            value={p.phone}
            onChange={e => save({ profile: { ...p, phone: e.target.value } })}
            className={inputCls}
            placeholder="+91 98XXX XXXXX"
            inputMode="tel"
            autoComplete="tel"
          />
          <span className="mt-1 block text-[11px] text-ink-400">The number you will message from. Indian numbers can skip the +91.</span>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="eyebrow">A brief about you</span>
        <textarea
          value={p.bio}
          onChange={e => save({ profile: { ...p, bio: e.target.value } })}
          rows={6}
          className={`${inputCls} resize-y`}
          placeholder="Who you are, what you do, what your week looks like, who you work with. Talk or type — rambling is fine."
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {voice.supported && <MicButton voice={voice} label="Talk instead" />}
        <button type="button" onClick={copyPrompt} className="rounded-md border border-ink-200 bg-white px-3 py-2 text-xs text-ink-700 hover:bg-ink-50">
          {copied ? 'Copied ✓' : 'Copy a prompt for your Claude / ChatGPT'}
        </button>
      </div>
      <details className="mt-2 text-xs text-ink-500">
        <summary className="cursor-pointer">What the prompt does</summary>
        <p className="mt-1 leading-relaxed">
          Paste it into the AI you already talk to. It writes a brief about you from everything it already knows. Paste the result above — fastest way to a chief of staff that is not starting from zero.
        </p>
        <pre className="mt-2 whitespace-pre-wrap rounded bg-cream-50 p-2 font-sans text-[11px] text-ink-600">{SELF_BRIEF_PROMPT}</pre>
      </details>
      {voice.error && <p className="mt-1 text-xs text-rose-600">{voice.error}</p>}

      <label className="mt-4 block">
        <span className="eyebrow">Links (optional)</span>
        <textarea
          value={linksText}
          onChange={e => {
            setLinksText(e.target.value);
            save({ profile: { ...p, links: e.target.value.split(/[\n,]/).map(s => s.trim()).filter(Boolean) } });
          }}
          rows={2}
          className={`${inputCls} resize-y`}
          placeholder="LinkedIn, website, Instagram — one per line"
        />
      </label>

      <SafetyNote className="mt-5" />
      <div className="mt-5 flex justify-end">
        <PrimaryButton onClick={next} disabled={!ready}>
          Design my chief of staff →
        </PrimaryButton>
      </div>
      {!ready && <p className="mt-2 text-right text-[11px] text-ink-400">Name and WhatsApp number to continue.</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Design (guided interview)
// ---------------------------------------------------------------------------
function DesignStep({
  agent,
  setAgent,
  uid,
  next,
  back
}: {
  agent: CosAgent;
  setAgent: React.Dispatch<React.SetStateAction<CosAgent | null>>;
  uid: string;
  next: () => void;
  back: () => void;
}) {
  const authedFetch = useAuthedFetch();
  const [messages, setMessages] = useState<Turn[]>(agent.interview.map(m => ({ role: m.role, text: m.text, at: m.at })));
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [started, setStarted] = useState(agent.interview.length > 0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const voice = useVoice(t => setDraft(d => (d ? d + ' ' + t : t)));
  const draftKey = `cos_draft_msg:${uid}`;

  // Keep an unsent draft across reloads — mobile Safari loves to reload.
  useEffect(() => {
    try {
      const d = sessionStorage.getItem(draftKey);
      if (d) setDraft(d);
    } catch {
      // ignore
    }
  }, [draftKey]);
  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, draft);
    } catch {
      // ignore
    }
  }, [draft, draftKey]);

  useEffect(() => {
    if (started) return;
    (async () => {
      const res = await authedFetch('/api/cos/interview', { method: 'POST', body: JSON.stringify({ action: 'start' }) });
      if (!res.ok) {
        setErr('Could not start the interview — check your connection and reload.');
        return;
      }
      const d = (await res.json()) as { messages: CosMessage[] };
      setMessages(d.messages.map(m => ({ role: m.role, text: m.text, at: m.at })));
      setStarted(true);
    })();
  }, [started, authedFetch]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (voice.listening) voice.toggle();
    voice.clearAudio();
    setErr(null);
    setSending(true);
    setMessages(prev => [...prev, { role: 'user', text }]);
    try {
      const res = await authedFetch('/api/cos/interview', {
        method: 'POST',
        body: JSON.stringify({ action: 'message', text })
      });
      if (!res.ok) {
        setMessages(prev => prev.slice(0, -1));
        setErr(res.status === 429 ? await res.text() : 'That did not send — your answer is still in the box. Try again.');
        return;
      }
      setDraft('');
      const d = (await res.json()) as { reply: string; spec: CosSpec; done: boolean };
      setMessages(prev => [...prev, { role: 'agent', text: d.reply }]);
      setAgent(prev =>
        prev ? { ...prev, spec: d.spec, interviewDone: d.done, agentMd: prev.agentMdEdited ? prev.agentMd : compileAgentMd({ ...prev, spec: d.spec }) } : prev
      );
    } catch {
      setMessages(prev => prev.slice(0, -1));
      setErr('No connection — your answer is still in the box. Try again in a moment.');
    } finally {
      setSending(false);
    }
  };

  const restart = async () => {
    if (!confirm('Start the interview again? What you have answered so far stays in the review step.')) return;
    const res = await authedFetch('/api/cos/interview', { method: 'POST', body: JSON.stringify({ action: 'restart' }) });
    if (!res.ok) return;
    const d = (await res.json()) as { messages: CosMessage[] };
    setMessages(d.messages.map(m => ({ role: m.role, text: m.text })));
  };

  const filledCount = COS_SECTIONS.filter(s => sectionFilled(agent.spec, s.key)).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
      <div className="flex h-[72vh] min-h-[460px] flex-col overflow-hidden rounded-lg border border-ink-200 bg-white">
        <div className="flex items-center justify-between border-b border-ink-100 bg-cream-50 px-4 py-2.5">
          <div>
            <p className="eyebrow">Step 2 · Design</p>
            <p className="text-xs text-ink-500">
              {filledCount}/{COS_SECTIONS.length} sections filled
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={restart} className="text-[11px] text-ink-400 hover:text-ink-700">
              restart
            </button>
            <button type="button" onClick={next} className="rounded-md border border-ink-200 bg-white px-2.5 py-1 text-xs text-ink-700 hover:bg-ink-50">
              {agent.interviewDone || filledCount === COS_SECTIONS.length ? 'Review →' : 'Skip to review →'}
            </button>
          </div>
        </div>

        <div className="lg:hidden">
          <SectionChips spec={agent.spec} compact />
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user' ? 'bg-ink-900 text-cream' : 'border border-ink-200 bg-cream-50 text-ink-800'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {sending && <p className="text-xs text-ink-400">Thinking…</p>}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-ink-100 p-2.5 sm:p-3">
          {err && <p className="mb-1.5 text-[11px] text-rose-600">{err}</p>}
          {voice.error && <p className="mb-1.5 text-[11px] text-rose-600">{voice.error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !isTouch()) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder={voice.listening ? 'Listening… tap the mic again to stop' : 'Type, or tap the mic and talk'}
              className="flex-1 resize-none rounded-md border border-ink-200 px-3 py-2 text-sm leading-relaxed focus:border-ink-400 focus:outline-none"
            />
            {voice.supported && <MicButton voice={voice} />}
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !draft.trim()}
              className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      <div className="hidden lg:block">
        <div className="rounded-lg border border-ink-200 bg-white p-4">
          <p className="eyebrow">What we are filling</p>
          <SectionChips spec={agent.spec} />
          <p className="mt-3 text-[11px] leading-relaxed text-ink-400">Answer in any order — one answer can fill several. You can edit everything in the next step.</p>
          <button type="button" onClick={back} className="mt-3 text-[11px] text-ink-400 hover:text-ink-700">
            ← back to about you
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionChips({ spec, compact }: { spec: CosSpec; compact?: boolean }) {
  return (
    <ul className={compact ? 'no-scrollbar flex gap-1.5 overflow-x-auto border-b border-ink-100 px-3 py-2' : 'mt-2 space-y-1.5'}>
      {COS_SECTIONS.map(s => {
        const ok = sectionFilled(spec, s.key);
        return (
          <li
            key={s.key}
            className={`${compact ? 'shrink-0 rounded-full border px-2 py-0.5 text-[10px]' : 'flex items-start gap-2 text-xs'} ${
              ok ? (compact ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'text-ink-800') : compact ? 'border-ink-200 text-ink-400' : 'text-ink-400'
            }`}
            title={s.hint}
          >
            {!compact && <span className="mt-0.5 w-3 text-center">{ok ? '✓' : '○'}</span>}
            <span>{s.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Review
// ---------------------------------------------------------------------------
function ReviewStep({ agent, save, next, back }: { agent: CosAgent; save: (p: Partial<CosAgent>) => void; next: () => void; back: () => void }) {
  const s = agent.spec;
  const [showMd, setShowMd] = useState(false);
  const md = effectiveAgentMd(agent);
  const complete = allSectionsFilled(s);

  const field = (key: keyof CosSpec, label: string, hint: string, rows = 3) => (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <textarea
        value={String(s[key] ?? '')}
        onChange={e => save({ spec: { ...s, [key]: e.target.value } })}
        rows={rows}
        className={`${inputCls} resize-y`}
        placeholder={hint}
      />
    </label>
  );

  const flag = (key: keyof CosSpec['toolFlags'], label: string) => (
    <label className="flex items-center gap-2 text-sm text-ink-700">
      <input
        type="checkbox"
        checked={s.toolFlags[key]}
        onChange={e => save({ spec: { ...s, toolFlags: { ...s.toolFlags, [key]: e.target.checked } } })}
        className="h-4 w-4 accent-[#c64a1f]"
      />
      {label}
    </label>
  );

  return (
    <Card>
      <p className="eyebrow">Step 3</p>
      <h2 className="mt-1 font-display text-xl text-ink-900 sm:text-2xl">Review what you built</h2>
      <p className="mt-2 text-sm text-ink-600">This is the brief your chief of staff runs on. Edit anything. The compiled document updates as you type.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="eyebrow">Name of your chief of staff</span>
          <input value={s.agentName} onChange={e => save({ spec: { ...s, agentName: e.target.value } })} className={inputCls} placeholder="Chief of Staff" />
        </label>
        {field('role', 'Role', 'What they own')}
        {field('objective', 'Objective', 'What success looks like in a month')}
        <div className="sm:col-span-2">{field('knows', 'What they already know', 'Your world, priorities, the people that matter', 4)}</div>
        {field('cadence', 'When they reach out', 'Morning brief? Only when a decision is needed? Quiet hours?')}
        {field('voice', 'How they speak', 'Short and blunt, warm, formal, language mix')}
        <div className="sm:col-span-2">{field('rules', 'Rules', 'Always / never / ask first', 3)}</div>
        <div className="sm:col-span-2">
          <span className="eyebrow">Tools</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {flag('calendarRead', 'Read my Google Calendar')}
            {flag('calendarWrite', 'Create calendar events for me')}
            {flag('gmailRead', 'Read my Gmail (never send)')}
            {flag('reminders', 'Send me WhatsApp reminders')}
          </div>
          <div className="mt-2">{field('tools', 'Notes on tools', 'Anything they should never touch', 2)}</div>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-ink-200 bg-cream-50">
        <button type="button" onClick={() => setShowMd(v => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-ink-800">
          <span>
            <span className="font-medium">agent.md</span> <span className="text-ink-400">— the compiled operating document</span>
          </span>
          <span className="text-ink-400">{showMd ? '▾' : '▸'}</span>
        </button>
        {showMd && (
          <div className="border-t border-ink-200 p-3">
            <label className="mb-2 flex items-center gap-2 text-xs text-ink-600">
              <input
                type="checkbox"
                checked={agent.agentMdEdited}
                onChange={e => save({ agentMdEdited: e.target.checked, agentMd: e.target.checked ? md : compileAgentMd(agent) })}
                className="h-3.5 w-3.5 accent-[#c64a1f]"
              />
              Edit the document by hand (stops auto-compiling from the fields above)
            </label>
            <textarea
              value={agent.agentMdEdited ? agent.agentMd : md}
              readOnly={!agent.agentMdEdited}
              onChange={e => save({ agentMd: e.target.value })}
              rows={18}
              className={`${inputCls} resize-y font-mono text-[12px] leading-relaxed ${agent.agentMdEdited ? '' : 'bg-white/60 text-ink-600'}`}
            />
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={back} className="text-xs text-ink-400 hover:text-ink-700">
          ← back to the interview
        </button>
        <PrimaryButton onClick={() => { save({ status: 'live' }); next(); }} disabled={!complete}>
          {agent.status === 'live' ? 'Save & connect →' : 'Go live & connect →'}
        </PrimaryButton>
      </div>
      {!complete && <p className="mt-2 text-right text-[11px] text-ink-400">Fill every section (even a line) to go live.</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Connect
// ---------------------------------------------------------------------------
function ConnectStep({
  agent,
  setAgent,
  waNumber,
  googleAvailable,
  email,
  next,
  back,
  setToast
}: {
  agent: CosAgent;
  setAgent: React.Dispatch<React.SetStateAction<CosAgent | null>>;
  waNumber: string;
  googleAvailable: boolean;
  email: string;
  next: () => void;
  back: () => void;
  setToast: (t: string) => void;
}) {
  const authedFetch = useAuthedFetch();
  const [gmail, setGmail] = useState(agent.spec.toolFlags.gmailRead);
  const [busy, setBusy] = useState(false);
  const digits = waNumber.replace(/\D/g, '');
  const first = agent.profile.name.split(' ')[0] || '';
  const waLink = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(`Hi, it's ${first}`)}` : '';
  const g = agent.google;
  const hasCal = !!g && g.scopes.some(s => s.includes('calendar'));
  const hasMail = !!g && g.scopes.some(s => s.includes('gmail'));

  const connect = async () => {
    setBusy(true);
    try {
      const res = await authedFetch('/api/cos/google/start', { method: 'POST', body: JSON.stringify({ gmail }) });
      if (!res.ok) {
        setToast(await res.text());
        return;
      }
      const d = (await res.json()) as { url: string };
      window.location.href = d.url;
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    if (!confirm('Disconnect Google? Access is revoked immediately.')) return;
    setBusy(true);
    try {
      await authedFetch('/api/cos/google/disconnect', { method: 'POST' });
      setAgent(prev => (prev ? { ...prev, google: undefined } : prev));
      setToast('Google disconnected and access revoked.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <p className="eyebrow">Step 4</p>
        <h2 className="mt-1 font-display text-xl text-ink-900 sm:text-2xl">Connect</h2>
        <p className="mt-2 text-sm text-ink-600">Your chief of staff is live. Now give it a door and, if you like, a window into your week.</p>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-ink-900">WhatsApp</p>
            <p className="mt-1 text-sm text-ink-600">
              Message the Rhai number from <span className="font-medium text-ink-800">{agent.profile.phone || 'your number'}</span>. Your first message wakes your chief of staff up.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-800">ready</span>
        </div>
        {waLink ? (
          <a href={waLink} target="_blank" rel="noreferrer" className="mt-4 inline-block w-full rounded-md bg-[#25D366] px-4 py-3 text-center text-sm font-medium text-white sm:w-auto">
            Open WhatsApp and say hi →
          </a>
        ) : (
          <p className="mt-3 text-sm text-ink-600">Save the number Rhea shows on screen and send it a hi.</p>
        )}
        <p className="mt-2 text-[11px] text-ink-400">
          Wrong number? <button type="button" onClick={back} className="underline">Fix it in step 1</button>. If it does not answer within a minute, the number may not match — the console in the next step always works.
        </p>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-ink-900">Google Calendar & Gmail</p>
            <p className="mt-1 text-sm text-ink-600">So it can read your real week and inbox instead of guessing. Gmail is read-only — it can never send.</p>
          </div>
          {g ? (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-800">connected</span>
          ) : (
            <span className="shrink-0 rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-500">optional</span>
          )}
        </div>
        {g ? (
          <div className="mt-3 text-sm text-ink-700">
            <p>
              {g.email || email} · calendar {hasCal ? '✓' : '—'} · gmail {hasMail ? '✓' : '—'}
            </p>
            <button type="button" onClick={disconnect} disabled={busy} className="mt-2 text-xs text-ink-400 underline hover:text-ink-700">
              disconnect & revoke
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" checked={gmail} onChange={e => setGmail(e.target.checked)} className="h-4 w-4 accent-[#c64a1f]" />
              Include Gmail (read-only). Untick for calendar only.
            </label>
            <button
              type="button"
              onClick={connect}
              disabled={busy || !googleAvailable}
              className="mt-3 w-full rounded-md border border-ink-900 bg-white px-4 py-3 text-sm font-medium text-ink-900 hover:bg-ink-50 disabled:opacity-50 sm:w-auto"
            >
              {busy ? 'Opening Google…' : 'Connect Google →'}
            </button>
            {!googleAvailable && <p className="mt-2 text-xs text-ink-400">Google connection is not switched on for this server yet.</p>}
            <p className="mt-2 text-[11px] text-ink-400">
              Google may show an &ldquo;unverified app&rdquo; screen — this tool is new. Tap Advanced, then continue, if you are comfortable.
            </p>
          </div>
        )}
        <SafetyNote className="mt-4" />
      </Card>

      <div className="flex justify-end">
        <PrimaryButton onClick={next}>Talk to it →</PrimaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Live: test console + export
// ---------------------------------------------------------------------------
function LiveStep({ agent, waNumber, goTo }: { agent: CosAgent; waNumber: string; goTo: (n: number) => void }) {
  const authedFetch = useAuthedFetch();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const voice = useVoice(t => setDraft(d => (d ? d + ' ' + t : t)));
  const name = agent.spec.agentName.trim() || 'Chief of Staff';

  useEffect(() => {
    void authedFetch('/api/cos/chat')
      .then(r => (r.ok ? r.json() : { turns: [] }))
      .then((d: { turns: Turn[] }) => setTurns(d.turns ?? []));
  }, [authedFetch]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, sending]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (voice.listening) voice.toggle();
    voice.clearAudio();
    setErr(null);
    setSending(true);
    setTurns(prev => [...prev, { role: 'user', text }]);
    try {
      const res = await authedFetch('/api/cos/chat', { method: 'POST', body: JSON.stringify({ text }) });
      if (!res.ok) {
        setTurns(prev => prev.slice(0, -1));
        setErr('That did not send — try again.');
        return;
      }
      setDraft('');
      const d = (await res.json()) as { reply: string };
      setTurns(prev => [...prev, { role: 'agent', text: d.reply }]);
    } catch {
      setTurns(prev => prev.slice(0, -1));
      setErr('No connection — try again in a moment.');
    } finally {
      setSending(false);
    }
  };

  const exportMd = async () => {
    setExporting(true);
    try {
      const res = await authedFetch('/api/cos/export', { method: 'POST' });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chief-of-staff-${(agent.profile.name || 'me').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      setErr('Export failed — try again.');
    } finally {
      setExporting(false);
    }
  };

  const digits = waNumber.replace(/\D/g, '');

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="flex h-[70vh] min-h-[440px] flex-col overflow-hidden rounded-lg border border-ink-200 bg-white">
        <div className="border-b border-ink-100 bg-cream-50 px-4 py-2.5">
          <p className="eyebrow">Step 5 · Live</p>
          <p className="text-xs text-ink-500">{name} — same brain and memory as on WhatsApp</p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
          {turns.length === 0 && (
            <p className="text-sm text-ink-400">
              Try: &ldquo;What&rsquo;s on my calendar tomorrow?&rdquo; · &ldquo;Remind me at 6pm to call Amma&rdquo; · &ldquo;Any unread emails from clients?&rdquo;
            </p>
          )}
          {turns.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user' ? 'bg-ink-900 text-cream' : 'border border-ink-200 bg-cream-50 text-ink-800'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {sending && <p className="text-xs text-ink-400">{name} is working…</p>}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-ink-100 p-2.5 sm:p-3">
          {err && <p className="mb-1.5 text-[11px] text-rose-600">{err}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !isTouch()) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder={`Message ${name}…`}
              className="flex-1 resize-none rounded-md border border-ink-200 px-3 py-2 text-sm leading-relaxed focus:border-ink-400 focus:outline-none"
            />
            {voice.supported && <MicButton voice={voice} />}
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !draft.trim()}
              className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border border-ink-200 bg-white p-4">
          <p className="eyebrow">On WhatsApp</p>
          {digits ? (
            <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className="mt-2 block rounded-md bg-[#25D366] px-3 py-2 text-center text-sm font-medium text-white">
              Open WhatsApp →
            </a>
          ) : (
            <p className="mt-2 text-xs text-ink-500">Message the Rhai number from {agent.profile.phone}.</p>
          )}
          <p className="mt-2 text-[11px] text-ink-400">
            {agent.google ? 'Google connected.' : 'Google not connected — '}
            {!agent.google && (
              <button type="button" onClick={() => goTo(3)} className="underline">
                connect it
              </button>
            )}
          </p>
        </div>
        <div className="rounded-lg border border-ink-200 bg-white p-4">
          <p className="eyebrow">Take it home</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-600">
            One Markdown file: your agent.md plus build instructions you can paste into Claude Code to run this on your own number with your own dashboard.
          </p>
          <button type="button" onClick={exportMd} disabled={exporting} className="mt-3 w-full rounded-md border border-ink-900 bg-white px-3 py-2 text-sm font-medium text-ink-900 hover:bg-ink-50 disabled:opacity-50">
            {exporting ? 'Preparing…' : 'Download build kit (.md)'}
          </button>
        </div>
        <div className="rounded-lg border border-ink-200 bg-white p-4 text-xs text-ink-600">
          <p className="eyebrow">Keep tuning</p>
          <p className="mt-1 leading-relaxed">
            Everything you change in <button type="button" onClick={() => goTo(2)} className="underline">Review</button> applies to the next message. Things it learns in conversation land in its memory automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bits
// ---------------------------------------------------------------------------
function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <div className={`mx-auto ${wide ? 'max-w-4xl' : 'max-w-2xl'} px-4 py-6 sm:py-10`}>{children}</div>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-ink-200 bg-white p-4 sm:p-6">{children}</div>;
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-md bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50 sm:w-auto"
    >
      {children}
    </button>
  );
}

function MicButton({ voice, label }: { voice: ReturnType<typeof useVoice>; label?: string }) {
  return (
    <button
      type="button"
      onClick={voice.toggle}
      className={`rounded-full border px-3 py-2.5 text-base ${
        voice.listening ? 'animate-pulse border-rose-300 bg-rose-50 text-rose-700' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
      }`}
      title={voice.listening ? 'Stop recording' : 'Answer by voice'}
    >
      {voice.listening ? '● stop' : label ? `🎙 ${label}` : '🎙'}
    </button>
  );
}

const inputCls =
  'mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-ink-400 focus:outline-none';

function isTouch(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
}
