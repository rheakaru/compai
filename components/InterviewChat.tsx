'use client';

// The public interview page — a candidate's whole world. Deliberately
// self-contained: no auth, no nav into the dashboard, and the API it talks
// to knows only the role brief. Three phases: landing/contact → chat → done.

import { useEffect, useRef, useState } from 'react';
import { useVoice } from './useVoice';
import { validateContactFormat, type ContactErrors } from '@/lib/validation/contact';
import { APPLY_TYPE_OPTIONS, DEFAULT_AGENCIES } from '@/lib/rhai/types';
import { Field, inputCls } from './DiscoveryChat';

interface PublicInterview {
  id: string;
  title: string;
  active: boolean;
  publicIntro: string;
}

interface Msg {
  role: 'rhai' | 'candidate';
  text: string;
  audioUrl?: string;
}

export function InterviewChat({ slug }: { slug: string }) {
  const [interview, setInterview] = useState<PublicInterview | null | 'missing'>(null);
  const [phase, setPhase] = useState<'landing' | 'chat' | 'done'>('landing');

  // contact form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [applyType, setApplyType] = useState('');
  const [agency, setAgency] = useState('');
  const [agencyOther, setAgencyOther] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [fieldErr, setFieldErr] = useState<ContactErrors>({});
  const [extraErr, setExtraErr] = useState<{ cv?: string; applyType?: string; agency?: string }>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // chat
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const voice = useVoice(
    t => setDraft(d => (d ? d + ' ' + t : t)),
    { kind: 'interview', sessionId }
  );

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
    const errs = validateContactFormat({ name, email, phone }, { phoneMode: 'in10' });
    setFieldErr(errs);
    const agencyValue = agency === 'Other' ? agencyOther.trim() : agency;
    const extra: { cv?: string; applyType?: string; agency?: string } = {};
    if (!cvFile) extra.cv = 'Please upload your CV (PDF, DOC, or DOCX).';
    if (!applyType) extra.applyType = 'Please select how you found this role.';
    if (applyType === 'Agency' && !agencyValue) extra.agency = 'Please select the agency.';
    setExtraErr(extra);
    if (errs.name || errs.email || errs.phone || extra.cv || extra.applyType || extra.agency) return;

    setStarting(true);
    try {
      // 1) Upload the CV first — the interview can't start without it.
      setUploading(true);
      const fd = new FormData();
      fd.append('cv', cvFile as File);
      const up = await fetch(`/api/interview/${slug}/cv`, { method: 'POST', body: fd });
      setUploading(false);
      if (!up.ok) {
        setFormErr((await up.text()) || 'CV upload failed — please try again.');
        return;
      }
      const { url: resumeUrl, name: resumeName } = (await up.json()) as { url: string; name: string };

      // 2) Start the interview with the full candidate record.
      const res = await fetch(`/api/interview/${slug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          candidate: {
            name,
            email,
            phone,
            resumeUrl,
            resumeName,
            applyType,
            ...(applyType === 'Agency' ? { agencyName: agencyValue } : {})
          }
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
      setUploading(false);
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
    setMessages(prev => [...prev, { role: 'candidate', text, ...(audioUrl ? { audioUrl } : {}) }]);
    try {
      const res = await fetch(`/api/interview/${slug}`, {
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
              <Field error={fieldErr.name}>
                <input
                  type="text"
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    if (fieldErr.name) setFieldErr(p => ({ ...p, name: undefined }));
                  }}
                  placeholder="Full name *"
                  className={inputCls(fieldErr.name)}
                />
              </Field>
              <Field error={fieldErr.phone}>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                    if (fieldErr.phone) setFieldErr(p => ({ ...p, phone: undefined }));
                  }}
                  maxLength={10}
                  placeholder="10-digit mobile (WhatsApp) *"
                  className={inputCls(fieldErr.phone)}
                />
              </Field>
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

              {/* Apply Type — how they found the role */}
              <Field error={extraErr.applyType}>
                <select
                  value={applyType}
                  onChange={e => {
                    setApplyType(e.target.value);
                    setExtraErr(p => ({ ...p, applyType: undefined }));
                    if (e.target.value !== 'Agency') {
                      setAgency('');
                      setAgencyOther('');
                    }
                  }}
                  className={`${inputCls(extraErr.applyType)} ${applyType ? '' : 'text-ink-400'}`}
                >
                  <option value="">How did you find this role? *</option>
                  {APPLY_TYPE_OPTIONS.map(o => (
                    <option key={o} value={o} className="text-ink-900">
                      {o}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Agency name — only when the source is an agency */}
              {applyType === 'Agency' && (
                <Field error={extraErr.agency}>
                  <select
                    value={agency}
                    onChange={e => {
                      setAgency(e.target.value);
                      setExtraErr(p => ({ ...p, agency: undefined }));
                    }}
                    className={`${inputCls(extraErr.agency)} ${agency ? '' : 'text-ink-400'}`}
                  >
                    <option value="">Which agency? *</option>
                    {DEFAULT_AGENCIES.map(a => (
                      <option key={a} value={a} className="text-ink-900">
                        {a}
                      </option>
                    ))}
                    <option value="Other" className="text-ink-900">
                      Other…
                    </option>
                  </select>
                </Field>
              )}
              {applyType === 'Agency' && agency === 'Other' && (
                <input
                  type="text"
                  value={agencyOther}
                  onChange={e => setAgencyOther(e.target.value)}
                  placeholder="Agency name *"
                  className={inputCls()}
                />
              )}
            </div>

            {/* CV upload — mandatory */}
            <div>
              <label
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-sm ${
                  extraErr.cv ? 'border-rose-300 bg-rose-50/40' : 'border-ink-200 bg-white hover:bg-ink-50'
                }`}
              >
                <span className={cvFile ? 'truncate text-ink-800' : 'text-ink-500'}>
                  {cvFile ? `📄 ${cvFile.name}` : 'Upload your CV — PDF, DOC or DOCX *'}
                </span>
                <span className="shrink-0 rounded border border-ink-200 bg-cream-50 px-2 py-1 text-[11px] text-ink-600">
                  {cvFile ? 'Change' : 'Choose file'}
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={e => {
                    setCvFile(e.target.files?.[0] ?? null);
                    setExtraErr(p => ({ ...p, cv: undefined }));
                    setFormErr(null);
                  }}
                  className="hidden"
                />
              </label>
              {extraErr.cv && <p className="mt-1 text-xs text-rose-600">{extraErr.cv}</p>}
            </div>

            {formErr && <p className="text-xs text-rose-600">{formErr}</p>}
            <button
              type="button"
              onClick={start}
              disabled={starting}
              className="w-full rounded-md bg-ink-900 px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink-800 disabled:opacity-60 sm:w-auto"
            >
              {uploading ? 'Uploading CV…' : starting ? 'Starting…' : 'Start the interview →'}
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
            <div
              key={i}
              className={m.role === 'candidate' ? 'flex flex-col items-end gap-1.5' : 'flex flex-col items-start gap-1.5'}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === 'candidate' ? 'bg-ink-900 text-cream' : 'border border-ink-200 bg-cream-50 text-ink-800'
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
              🎙 Voice welcome — tap the mic, speak, and tap again to stop. The transcript appears when you stop
              recording. Trained on Indian English — the accuracy is good but proofread anything important before sending.
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
