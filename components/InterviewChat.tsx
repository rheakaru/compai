'use client';

// The public interview page — a candidate's whole world. Deliberately
// self-contained: no auth, no nav into the dashboard, and the API it talks
// to knows only the role brief. Three phases: landing/contact → chat → done.

import { useEffect, useRef, useState } from 'react';
import { useVoice } from './useVoice';

interface PublicInterview {
  id: string;
  title: string;
  active: boolean;
  publicIntro: string;
}

interface Msg {
  role: 'rhai' | 'candidate';
  text: string;
}

export function InterviewChat({ slug }: { slug: string }) {
  const [interview, setInterview] = useState<PublicInterview | null | 'missing'>(null);
  const [phase, setPhase] = useState<'landing' | 'chat' | 'done'>('landing');

  // contact form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // chat
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const voice = useVoice(t => setDraft(d => (d ? d + ' ' + t : t)));

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/interview/${slug}`);
      if (!res.ok) {
        setInterview('missing');
        return;
      }
      setInterview(((await res.json()) as { interview: PublicInterview }).interview);
    })().catch(() => setInterview('missing'));
  }, [slug]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const start = async () => {
    setFormErr(null);
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setFormErr('Name, email and phone are all needed so Rhea can reach you.');
      return;
    }
    setStarting(true);
    try {
      const res = await fetch(`/api/interview/${slug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          candidate: { name, email, phone, ...(resumeUrl.trim() ? { resumeUrl } : {}) }
        })
      });
      if (!res.ok) {
        setFormErr(await res.text());
        return;
      }
      const d = (await res.json()) as { sessionId: string; message: string };
      setSessionId(d.sessionId);
      setMessages([{ role: 'rhai', text: d.message }]);
      setPhase('chat');
    } finally {
      setStarting(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || !sessionId) return;
    if (voice.listening) voice.toggle();
    setDraft('');
    setSending(true);
    setMessages(prev => [...prev, { role: 'candidate', text }]);
    try {
      const res = await fetch(`/api/interview/${slug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'message', sessionId, text })
      });
      if (!res.ok) {
        setMessages(prev => [
          ...prev,
          { role: 'rhai', text: 'Sorry — something went wrong on my side. Please try sending that again.' }
        ]);
        return;
      }
      const d = (await res.json()) as { message: string; done: boolean };
      setMessages(prev => [...prev, { role: 'rhai', text: d.message }]);
      if (d.done) setTimeout(() => setPhase('done'), 2500);
    } finally {
      setSending(false);
    }
  };

  // ---- render ----

  if (interview === null)
    return (
      <Shell>
        <p className="text-sm text-ink-400">Loading…</p>
      </Shell>
    );
  if (interview === 'missing' || !interview.active)
    return (
      <Shell>
        <div className="rounded-lg border border-ink-200 bg-white p-8 text-center">
          <p className="font-display text-xl text-ink-900">This interview isn&apos;t open right now.</p>
          <p className="mt-2 text-sm text-ink-500">The position may have been filled — thank you for your interest!</p>
        </div>
      </Shell>
    );

  if (phase === 'landing') {
    return (
      <Shell>
        <div className="rounded-lg border border-ink-200 bg-white p-6 sm:p-8">
          <p className="eyebrow">Interview with Rhai</p>
          <h1 className="mt-2 font-display text-2xl tracking-tight text-ink-900 sm:text-3xl">{interview.title}</h1>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-600">{interview.publicIntro}</p>

          <div className="mt-6 space-y-3">
            <p className="eyebrow">Your contact details</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Full name *"
                className="rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-ink-400 focus:outline-none"
              />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Phone (WhatsApp) *"
                className="rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-ink-400 focus:outline-none"
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email *"
                className="rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-ink-400 focus:outline-none"
              />
              <input
                type="url"
                value={resumeUrl}
                onChange={e => setResumeUrl(e.target.value)}
                placeholder="Resume / portfolio link (optional)"
                className="rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-ink-400 focus:outline-none"
              />
            </div>
            {formErr && <p className="text-xs text-rose-600">{formErr}</p>}
            <button
              type="button"
              onClick={start}
              disabled={starting}
              className="w-full rounded-md bg-ink-900 px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink-800 disabled:opacity-60 sm:w-auto"
            >
              {starting ? 'Starting…' : 'Start the interview →'}
            </button>
            <p className="text-[11px] text-ink-400">
              Your answers go to Rhea directly. The conversation takes about 10–15 minutes.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  if (phase === 'done') {
    return (
      <Shell>
        <div className="rounded-lg border border-ink-200 bg-white p-8 text-center">
          <p className="font-display text-2xl text-ink-900">Thank you, {name.split(' ')[0]}!</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
            Your interview has been saved and sent to Rhea — she personally reads every conversation, including any
            questions you left for her. You&apos;ll hear back at <span className="font-medium">{email}</span>.
          </p>
          <p className="mt-4 text-xs text-ink-400">You can close this page now.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell wide>
      <div className="flex h-[80vh] flex-col overflow-hidden rounded-lg border border-ink-200 bg-white">
        <div className="border-b border-ink-100 bg-cream-50 px-4 py-3">
          <p className="eyebrow">Interview with Rhai</p>
          <p className="text-xs text-ink-500">{interview.title}</p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'candidate' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === 'candidate' ? 'bg-ink-900 text-cream' : 'border border-ink-200 bg-cream-50 text-ink-800'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {sending && <p className="text-xs text-ink-400">Rhai is typing…</p>}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-ink-100 p-3">
          {voice.supported && (
            <p className="mb-1.5 text-[10px] text-ink-400">
              🎙 Voice encouraged — tap the mic and just talk. The transcript won&apos;t be perfect, and that&apos;s
              totally fine: fix anything important in the box, then send. We read for meaning, not spelling.
            </p>
          )}
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
              placeholder="Type your answer — or use the mic…"
              className="flex-1 resize-none rounded-md border border-ink-200 px-3 py-2 text-sm leading-relaxed focus:border-ink-400 focus:outline-none"
            />
            {voice.supported && (
              <button
                type="button"
                onClick={voice.toggle}
                className={`rounded-full border px-3 py-2.5 text-base ${
                  voice.listening ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-ink-200 text-ink-500 hover:bg-ink-50'
                }`}
                title="Answer by voice"
              >
                {voice.listening ? '●' : '🎙'}
              </button>
            )}
            <button
              type="button"
              onClick={send}
              disabled={sending || !draft.trim()}
              className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/** Neutral page chrome — no dashboard nav, nothing to wander into. */
function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto ${wide ? 'max-w-3xl' : 'max-w-2xl'} px-4 py-8 sm:py-12`}>{children}</div>
  );
}
