'use client';

// The candidate's whole world for a Rhai Interviews role. Deliberately
// self-contained: no auth, no nav anywhere else. Landing (contact form with
// validation) → structured interview chat → done.

import { useEffect, useRef, useState } from 'react';
import { validateContactFormat, type ContactErrors } from '@/lib/validation/contact';
import { Field, inputCls } from './DiscoveryChat';

interface PublicJob {
  id: string;
  title: string;
  companyName: string;
  open: boolean;
  closedReason: 'closed' | 'capacity' | null;
}

interface Msg {
  role: 'rhai' | 'candidate';
  text: string;
}

export function ApplyChat({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<PublicJob | null | 'missing'>(null);
  const [phase, setPhase] = useState<'landing' | 'chat' | 'done'>('landing');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [fieldErr, setFieldErr] = useState<ContactErrors>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/apply/${jobId}`);
      if (!res.ok) return setJob('missing');
      setJob(((await res.json()) as { job: PublicJob }).job);
    })().catch(() => setJob('missing'));
  }, [jobId]);

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
      const res = await fetch(`/api/apply/${jobId}`, {
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
      const d = (await res.json()) as { applicationId: string; message: string };
      setApplicationId(d.applicationId);
      setMessages([{ role: 'rhai', text: d.message }]);
      setPhase('chat');
    } finally {
      setStarting(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || !applicationId) return;
    setDraft('');
    setSending(true);
    setMessages(prev => [...prev, { role: 'candidate', text }]);
    try {
      const res = await fetch(`/api/apply/${jobId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'message', applicationId, text })
      });
      if (!res.ok) {
        setMessages(prev => [...prev, { role: 'rhai', text: 'Sorry — something went wrong. Please send that again.' }]);
        return;
      }
      const d = (await res.json()) as { message: string; done: boolean };
      setMessages(prev => [...prev, { role: 'rhai', text: d.message }]);
      if (d.done) setTimeout(() => setPhase('done'), 2500);
    } finally {
      setSending(false);
    }
  };

  if (job === null) return <Shell><p className="text-sm text-ink-400">Loading…</p></Shell>;
  if (job === 'missing')
    return (
      <Shell>
        <Card><p className="font-display text-xl text-ink-900">This role doesn&apos;t exist.</p></Card>
      </Shell>
    );
  if (!job.open && phase === 'landing')
    return (
      <Shell>
        <Card>
          <p className="font-display text-xl text-ink-900">
            {job.closedReason === 'capacity' ? 'This role has paused new applications.' : "This role isn't open right now."}
          </p>
          <p className="mt-2 text-sm text-ink-500">
            {job.closedReason === 'capacity' ? 'Check back soon — the team may reopen it.' : 'Thank you for your interest!'}
          </p>
        </Card>
      </Shell>
    );

  if (phase === 'landing') {
    return (
      <Shell>
        <Card>
          <p className="eyebrow">First-round interview · {job.companyName}</p>
          <h1 className="mt-2 font-display text-2xl tracking-tight text-ink-900 sm:text-3xl">{job.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            This is a structured interview conducted by Rhai, {job.companyName}&apos;s AI interviewer — the same
            questions for every candidate, reviewed by the hiring team. It takes about 15–20 minutes. Answer in your
            own words; real examples beat polish.
          </p>
          <div className="mt-6 space-y-3">
            <p className="eyebrow">Your details</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field error={fieldErr.name}>
                <input type="text" value={name} onChange={e => { setName(e.target.value); if (fieldErr.name) setFieldErr(p => ({ ...p, name: undefined })); }} placeholder="Full name *" className={inputCls(fieldErr.name)} />
              </Field>
              <Field error={fieldErr.phone}>
                <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); if (fieldErr.phone) setFieldErr(p => ({ ...p, phone: undefined })); }} placeholder="Phone *" className={inputCls(fieldErr.phone)} />
              </Field>
              <Field error={fieldErr.email}>
                <input type="email" value={email} onChange={e => { setEmail(e.target.value); if (fieldErr.email) setFieldErr(p => ({ ...p, email: undefined })); }} placeholder="Email *" className={inputCls(fieldErr.email)} />
              </Field>
              <input type="url" value={resumeUrl} onChange={e => setResumeUrl(e.target.value)} placeholder="Resume / portfolio link (optional)" className={inputCls()} />
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
            <p className="text-[11px] text-ink-400">One application per person. Your answers go only to the {job.companyName} hiring team.</p>
          </div>
        </Card>
      </Shell>
    );
  }

  if (phase === 'done') {
    return (
      <Shell>
        <Card center>
          <p className="font-display text-2xl text-ink-900">Thank you, {name.split(' ')[0]}!</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
            Your interview is complete and with the {job.companyName} hiring team. They&apos;ll be in touch at{' '}
            <span className="font-medium">{email}</span>.
          </p>
          <p className="mt-4 text-xs text-ink-400">You can close this page now.</p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell wide>
      <div className="flex h-[82vh] flex-col overflow-hidden rounded-lg border border-ink-200 bg-white">
        <div className="border-b border-ink-100 bg-cream-50 px-4 py-3">
          <p className="eyebrow">{job.companyName} · first-round interview</p>
          <p className="text-xs text-ink-500">{job.title}</p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'candidate' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${m.role === 'candidate' ? 'bg-ink-900 text-cream' : 'border border-ink-200 bg-cream-50 text-ink-800'}`}>
                {m.text}
              </div>
            </div>
          ))}
          {sending && <p className="text-xs text-ink-400">Rhai is typing…</p>}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-ink-100 p-3">
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
              placeholder="Type your answer…"
              className="flex-1 resize-none rounded-md border border-ink-200 px-3 py-2 text-sm leading-relaxed focus:border-ink-400 focus:outline-none"
            />
            <button type="button" onClick={send} disabled={sending || !draft.trim()} className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50">
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
function Card({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return <div className={`rounded-lg border border-ink-200 bg-white p-6 sm:p-8 ${center ? 'text-center' : ''}`}>{children}</div>;
}
