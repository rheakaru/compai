'use client';

// Public discovery chat — visitor arrives from heyrhai.com, gives contact
// details, then has a warm 10-minute conversation with Rhai. Same sandbox
// posture as InterviewChat: no auth, no nav, no dashboard peek. On completion
// a lead lands in Rhea's pipeline + a suggestion pings on Today.

import { useEffect, useRef, useState } from 'react';
import { useVoice } from './useVoice';
import { validateContactFormat, type ContactErrors } from '@/lib/validation/contact';

interface Msg {
  role: 'rhai' | 'guest';
  text: string;
  audioUrl?: string;
}

export function DiscoveryChat() {
  const [phase, setPhase] = useState<'landing' | 'chat' | 'done'>('landing');

  // contact form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [fieldErr, setFieldErr] = useState<ContactErrors>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // chat
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const voice = useVoice(
    t => setDraft(d => (d ? d + ' ' + t : t)),
    { kind: 'discovery', sessionId }
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const start = async () => {
    setFormErr(null);
    const errs = validateContactFormat({ name, email, phone });
    setFieldErr(errs);
    if (errs.name || errs.email || errs.phone) return;
    setStarting(true);
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          contact: { name, email, phone, ...(company.trim() ? { company } : {}) }
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
    const audioUrl = voice.lastAudioUrl;
    voice.clearAudio();
    setDraft('');
    setSending(true);
    setMessages(prev => [...prev, { role: 'guest', text, ...(audioUrl ? { audioUrl } : {}) }]);
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'message', sessionId, text, ...(audioUrl ? { audioUrl } : {}) })
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

  if (phase === 'landing') {
    return (
      <Shell>
        <div className="rounded-lg border border-ink-200 bg-white p-6 sm:p-8">
          <p className="eyebrow">Talk to Rhai</p>
          <h1 className="mt-2 font-display text-2xl tracking-tight text-ink-900 sm:text-3xl">
            A short conversation — then Rhea comes back with something specific.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            Rather than trade emails, tell Rhai (Rhea&apos;s AI cofounder) about you and your business. About 10 minutes.
            You can type or use the mic — whatever&apos;s easier. Rhea reads every conversation herself and gets back
            within a working day or two.
          </p>

          <div className="mt-6 space-y-3">
            <p className="eyebrow">Your details</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field error={fieldErr.name}>
                <input
                  type="text"
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    if (fieldErr.name) setFieldErr(p => ({ ...p, name: undefined }));
                  }}
                  placeholder="Your name *"
                  className={inputCls(fieldErr.name)}
                />
              </Field>
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="Company (optional)"
                className={inputCls()}
              />
              <Field error={fieldErr.email}>
                <input
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (fieldErr.email) setFieldErr(p => ({ ...p, email: undefined }));
                  }}
                  placeholder="Email *"
                  className={inputCls(fieldErr.email)}
                />
              </Field>
              <Field error={fieldErr.phone}>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value);
                    if (fieldErr.phone) setFieldErr(p => ({ ...p, phone: undefined }));
                  }}
                  placeholder="Phone / WhatsApp *"
                  className={inputCls(fieldErr.phone)}
                />
              </Field>
            </div>
            {formErr && <p className="text-xs text-rose-600">{formErr}</p>}
            <button
              type="button"
              onClick={start}
              disabled={starting}
              className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60 sm:w-auto"
            >
              {starting ? 'Starting…' : 'Start the conversation →'}
            </button>
            <p className="text-[11px] text-ink-400">
              Your details go to Rhea directly. Nothing is shared elsewhere.
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
          <p className="font-display text-2xl text-ink-900">Thanks, {name.split(' ')[0]}.</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
            Rhea just got your conversation. She&apos;ll reply directly at{' '}
            <span className="font-medium">{email}</span> within 1–2 working days with something specific to what you
            said — not a template.
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
          <p className="eyebrow">Talk to Rhai</p>
          <p className="text-xs text-ink-500">Rhea&apos;s AI cofounder — discovery conversation</p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === 'guest' ? 'flex flex-col items-end gap-1.5' : 'flex flex-col items-start gap-1.5'}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === 'guest' ? 'bg-ink-900 text-cream' : 'border border-ink-200 bg-cream-50 text-ink-800'
                }`}
              >
                {m.text}
              </div>
              {m.audioUrl && (
                <audio controls preload="none" src={m.audioUrl} className="h-8 max-w-[85%]" />
              )}
            </div>
          ))}
          {sending && <p className="text-xs text-ink-400">Rhai is typing…</p>}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-ink-100 p-3">
          {voice.supported && (
            <p className="mb-1.5 text-[10px] text-ink-400">
              🎙 Voice welcome — tap the mic, speak, then tap again to stop. Trained on Indian English — proofread
              anything important before sending.
            </p>
          )}
          {voice.error && <p className="mb-1.5 text-[10px] text-rose-600">{voice.error}</p>}
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
                  voice.listening
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : 'border-ink-200 text-ink-500 hover:bg-ink-50'
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

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <div className={`mx-auto ${wide ? 'max-w-3xl' : 'max-w-2xl'} px-4 py-8 sm:py-12`}>{children}</div>;
}

export function inputCls(error?: string) {
  return `w-full rounded-md border px-3 py-2 text-sm focus:outline-none ${
    error ? 'border-rose-400 focus:border-rose-500' : 'border-ink-200 focus:border-ink-400'
  }`;
}

export function Field({ error, children }: { error?: string; children: React.ReactNode }) {
  return (
    <div>
      {children}
      {error && <p className="mt-1 text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}
