'use client';

// Public voice-testimonial page. Someone lands here after a Rhai session —
// workshop or community — records a short voice note about their experience,
// previews it, signs it with name (+ optional "what you do"), and sends. Deliberately
// tiny and warm — one screen, a few taps, done in two minutes.

import { useCallback, useEffect, useRef, useState } from 'react';

type Phase = 'intro' | 'recording' | 'recorded' | 'sending' | 'done';
const MAX_SECONDS = 150;

function pickMime(): string | undefined {
  const c = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  const MR = typeof window !== 'undefined' ? (window.MediaRecorder as typeof MediaRecorder & { isTypeSupported?: (t: string) => boolean }) : undefined;
  if (!MR?.isTypeSupported) return undefined;
  return c.find(t => MR.isTypeSupported!(t));
}
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function VoiceTestimonial() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const mrRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };
  useEffect(() => () => { cleanupStream(); if (url) URL.revokeObjectURL(url); if (tickRef.current) clearInterval(tickRef.current); }, [url]);

  const stop = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    const mr = mrRef.current;
    if (mr && mr.state !== 'inactive') mr.stop();
  }, []);

  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      streamRef.current = stream;
      const mime = pickMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mrRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        cleanupStream();
        const b = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        if (b.size === 0) { setErr('Nothing recorded — try again.'); setPhase('intro'); return; }
        if (url) URL.revokeObjectURL(url);
        setBlob(b);
        setUrl(URL.createObjectURL(b));
        setPhase('recorded');
      };
      mr.start();
      durationRef.current = 0;
      setSeconds(0);
      setPhase('recording');
      tickRef.current = setInterval(() => {
        durationRef.current += 1;
        setSeconds(durationRef.current);
        if (durationRef.current >= MAX_SECONDS) stop();
      }, 1000);
    } catch {
      setErr('I need mic access to record — please allow it and try again.');
    }
  };

  const reRecord = () => {
    if (url) URL.revokeObjectURL(url);
    setBlob(null); setUrl(null); setSeconds(0); setErr(null);
    setPhase('intro');
  };

  const send = async () => {
    if (!blob || name.trim().length < 2) { setErr('Please add your name so I know who to thank.'); return; }
    setErr(null);
    setPhase('sending');
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'testimonial.webm');
      fd.append('name', name.trim());
      if (role.trim()) fd.append('role', role.trim());
      fd.append('durationSec', String(seconds));
      const res = await fetch('/api/testimonial', { method: 'POST', body: fd });
      if (!res.ok) { setErr(await res.text()); setPhase('recorded'); return; }
      setPhase('done');
    } catch {
      setErr('Something went wrong sending it — please try again.');
      setPhase('recorded');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-5 py-10 text-ink-900">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
          <span className="font-display text-lg font-medium tracking-tight">Rhai</span>
        </div>

        {phase === 'done' ? (
          <Card center>
            <p className="text-4xl">🎙️</p>
            <p className="mt-3 font-display text-2xl text-ink-900">Thank you, {name.split(' ')[0]}!</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-600">
              Rhea got your voice note. She might feature it on heyrhai.com — with your name on it. It meant a lot that you trusted us to learn with you.
            </p>
          </Card>
        ) : (
          <Card>
            <p className="eyebrow text-center">Rhai · a quick favour</p>
            <h1 className="mt-2 text-center font-display text-[26px] leading-tight tracking-tight text-ink-900 sm:text-3xl">
              How was your Rhai session?
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-ink-600">
              Tell me in your own voice — what you built, what clicked, or who you&apos;d send. Thirty seconds is plenty. No script.
            </p>

            <div className="mt-7">
              {phase === 'intro' && (
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={start}
                    className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-white shadow-lg transition hover:bg-accent-600 active:scale-95"
                    aria-label="Start recording"
                  >
                    <span className="text-4xl">🎙️</span>
                  </button>
                  <p className="mt-4 text-xs text-ink-400">Tap to record · up to {MAX_SECONDS / 60} min</p>
                </div>
              )}

              {phase === 'recording' && (
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={stop}
                    className="relative flex h-24 w-24 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg transition hover:bg-rose-600 active:scale-95"
                    aria-label="Stop recording"
                  >
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-40" />
                    <span className="h-7 w-7 rounded bg-white" />
                  </button>
                  <p className="mt-4 font-mono text-lg tabular-nums text-ink-800">{fmt(seconds)}</p>
                  <p className="mt-1 text-xs text-ink-400">Tap the square to stop</p>
                </div>
              )}

              {(phase === 'recorded' || phase === 'sending') && url && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-ink-200 bg-cream-50 p-4">
                    <p className="mb-2 text-center text-xs text-ink-400">Have a listen 👇</p>
                    <audio src={url} controls className="w-full" />
                    <button type="button" onClick={reRecord} disabled={phase === 'sending'} className="mt-3 w-full text-center text-xs text-ink-500 hover:text-accent disabled:opacity-50">
                      ↺ re-record
                    </button>
                  </div>
                  <div className="space-y-2">
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Your name *"
                      className="w-full rounded-md border border-ink-200 px-3 py-2.5 text-sm focus:border-ink-400 focus:outline-none"
                    />
                    <input
                      value={role}
                      onChange={e => setRole(e.target.value)}
                      placeholder="What you do (optional) — e.g. founder, Hoovu Fresh"
                      className="w-full rounded-md border border-ink-200 px-3 py-2.5 text-sm focus:border-ink-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={send}
                    disabled={phase === 'sending' || name.trim().length < 2}
                    className="w-full rounded-md bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
                  >
                    {phase === 'sending' ? 'Sending…' : 'Send it to Rhea →'}
                  </button>
                </div>
              )}
            </div>

            {err && <p className="mt-4 text-center text-xs text-rose-600">{err}</p>}
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return <div className={`rounded-2xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8 ${center ? 'text-center' : ''}`}>{children}</div>;
}
