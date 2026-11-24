'use client';

// Records one speaker's turn on their own phone/laptop.
//
// Two things run off the same mic stream while they talk:
//  1. A continuous MediaRecorder for the whole turn. On stop it's sent to
//     ElevenLabs Scribe and becomes the turn's final, accurate text.
//  2. A live preview so they see their words appear:
//       - desktop Chrome/Edge/Safari: the browser's SpeechRecognition (word by
//         word, instant);
//       - phones: short ~4s clips, each transcribed server-side and appended
//         (a few seconds behind). On phones the browser recogniser and
//         MediaRecorder fight over the mic, so we don't mix them there.
// The live text is pushed to the server about once a second so Rhea's console
// can follow along, and it's the fallback if the final pass fails.

import { useCallback, useEffect, useRef, useState } from 'react';

type RecState = 'idle' | 'starting' | 'recording' | 'uploading';

interface SR {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}

const SEGMENT_MS = 4000;
const LIVE_PUSH_MS = 900;

function isPhone(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch points give it away.
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return undefined;
}

function speechCtor(): (new () => SR) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface TurnAuth {
  roomId: string;
  participantId: string;
  token: string;
}

export function useTurnRecorder(auth: TurnAuth | null) {
  const [state, setState] = useState<RecState>('idle');
  const [live, setLive] = useState('');
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [turnId, setTurnId] = useState<string | null>(null);

  const authRef = useRef(auth);
  authRef.current = auth;
  const streamRef = useRef<MediaStream | null>(null);
  const pendingStreamRef = useRef<Promise<MediaStream> | null>(null);
  const fullRecRef = useRef<MediaRecorder | null>(null);
  const fullChunksRef = useRef<Blob[]>([]);
  const segRecRef = useRef<MediaRecorder | null>(null);
  const srRef = useRef<SR | null>(null);
  const activeRef = useRef(false);
  const turnRef = useRef<string | null>(null);
  const partsRef = useRef<string[]>([]);
  const srFinalRef = useRef('');
  const liveRef = useRef('');
  const pushedRef = useRef('');
  const pushTimerRef = useRef<number | null>(null);
  const meterRef = useRef<{ ctx: AudioContext; raf: number } | null>(null);

  const setLiveText = useCallback((t: string) => {
    liveRef.current = t;
    setLive(t);
  }, []);

  const pushLive = useCallback(async () => {
    const a = authRef.current;
    const tId = turnRef.current;
    if (!a || !tId || liveRef.current === pushedRef.current) return;
    const text = liveRef.current;
    pushedRef.current = text;
    await fetch(`/api/rooms/${a.roomId}/guest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ participantId: a.participantId, token: a.token, action: 'live', turnId: tId, text })
    }).catch(() => {
      pushedRef.current = '';
    });
  }, []);

  /**
   * Ask for the mic. Call this synchronously inside a tap handler so iOS
   * counts it as user-initiated; start() reuses the stream it gets.
   */
  const acquire = useCallback((): Promise<MediaStream> => {
    if (streamRef.current && streamRef.current.getAudioTracks().some(t => t.readyState === 'live')) {
      return Promise.resolve(streamRef.current);
    }
    if (pendingStreamRef.current) return pendingStreamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) return Promise.reject(new Error('This browser cannot use the microphone.'));
    const p = navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then(s => {
        streamRef.current = s;
        return s;
      })
      .finally(() => {
        pendingStreamRef.current = null;
      });
    pendingStreamRef.current = p;
    return p;
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (meterRef.current) {
      cancelAnimationFrame(meterRef.current.raf);
      meterRef.current.ctx.close().catch(() => undefined);
      meterRef.current = null;
    }
    setLevel(0);
  }, []);

  const startMeter = useCallback((stream: MediaStream) => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        if (meterRef.current) meterRef.current.raf = requestAnimationFrame(tick);
      };
      meterRef.current = { ctx, raf: requestAnimationFrame(tick) };
      void ctx.resume?.();
    } catch {
      /* meter is decoration */
    }
  }, []);

  const runSegment = useCallback(
    (stream: MediaStream, mime: string | undefined) => {
      if (!activeRef.current) return;
      let rec: MediaRecorder;
      try {
        rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch {
        return;
      }
      const chunks: Blob[] = [];
      const seq = partsRef.current.length;
      partsRef.current.push('');
      rec.ondataavailable = e => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        // Chain the next clip straight away so there's barely a gap.
        if (activeRef.current) runSegment(stream, mime);
        const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
        const a = authRef.current;
        const tId = turnRef.current;
        if (!a || !tId || blob.size < 1200) return;
        const fd = new FormData();
        fd.append('participantId', a.participantId);
        fd.append('token', a.token);
        fd.append('turnId', tId);
        fd.append('kind', 'segment');
        fd.append('audio', blob, 'segment');
        void fetch(`/api/rooms/${a.roomId}/guest/audio`, { method: 'POST', body: fd })
          .then(r => (r.ok ? (r.json() as Promise<{ text?: string }>) : { text: '' }))
          .then(j => {
            if (turnRef.current !== tId) return;
            partsRef.current[seq] = (j.text ?? '').trim();
            setLiveText(partsRef.current.filter(Boolean).join(' '));
          })
          .catch(() => undefined);
      };
      segRecRef.current = rec;
      rec.start();
      window.setTimeout(() => {
        if (rec.state === 'recording') rec.stop();
      }, SEGMENT_MS);
    },
    [setLiveText]
  );

  const startSpeech = useCallback(
    (Ctor: new () => SR) => {
      const sr = new Ctor();
      sr.lang = 'en-IN';
      sr.continuous = true;
      sr.interimResults = true;
      sr.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          const txt = r[0]?.transcript ?? '';
          if (r.isFinal) srFinalRef.current = `${srFinalRef.current} ${txt}`.trim();
          else interim += txt;
        }
        setLiveText(`${srFinalRef.current} ${interim}`.trim());
      };
      sr.onerror = () => undefined;
      // Chrome ends recognition after a pause; keep it going for the turn.
      sr.onend = () => {
        if (activeRef.current && srRef.current === sr) {
          try {
            sr.start();
          } catch {
            /* already running */
          }
        }
      };
      srRef.current = sr;
      try {
        sr.start();
      } catch {
        /* ignore */
      }
    },
    [setLiveText]
  );

  /** Begin recording a turn the server has opened. */
  const start = useCallback(
    async (id: string) => {
      if (activeRef.current) return;
      setError(null);
      setState('starting');
      let stream: MediaStream;
      try {
        stream = await acquire();
      } catch (e) {
        setState('idle');
        setError(
          e instanceof Error && e.name === 'NotAllowedError'
            ? 'Microphone is blocked. Allow it in your browser settings, then tap again.'
            : 'Could not start your microphone. Tap the button to try again.'
        );
        throw e;
      }
      activeRef.current = true;
      turnRef.current = id;
      setTurnId(id);
      partsRef.current = [];
      srFinalRef.current = '';
      pushedRef.current = '';
      setLiveText('');

      const mime = pickMime();
      fullChunksRef.current = [];
      try {
        const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        rec.ondataavailable = e => {
          if (e.data.size) fullChunksRef.current.push(e.data);
        };
        rec.start(1000);
        fullRecRef.current = rec;
      } catch {
        fullRecRef.current = null; // live text becomes the transcript
      }

      const Speech = speechCtor();
      if (!isPhone() && Speech) startSpeech(Speech);
      else runSegment(stream, mime);

      startMeter(stream);
      pushTimerRef.current = window.setInterval(() => void pushLive(), LIVE_PUSH_MS);
      setState('recording');
    },
    [acquire, pushLive, runSegment, setLiveText, startMeter, startSpeech]
  );

  /** Stop the current turn and upload the recording for the final pass. */
  const stop = useCallback(async () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    const tId = turnRef.current;
    setState('uploading');
    if (pushTimerRef.current) window.clearInterval(pushTimerRef.current);
    pushTimerRef.current = null;

    const sr = srRef.current;
    srRef.current = null;
    try {
      sr?.stop();
    } catch {
      /* ignore */
    }
    const seg = segRecRef.current;
    segRecRef.current = null;
    if (seg && seg.state === 'recording') seg.stop();

    const full = fullRecRef.current;
    fullRecRef.current = null;
    const blob: Blob | null = full
      ? await new Promise<Blob>(resolve => {
          full.onstop = () => resolve(new Blob(fullChunksRef.current, { type: full.mimeType || 'audio/webm' }));
          if (full.state !== 'inactive') full.stop();
          else resolve(new Blob(fullChunksRef.current, { type: full.mimeType || 'audio/webm' }));
        })
      : null;
    releaseStream();

    // Give the last live clip a moment, then make sure the server has the
    // latest live text before the final pass (it's the fallback).
    await new Promise(r => setTimeout(r, 300));
    await pushLive();

    const a = authRef.current;
    if (a && tId) {
      const fd = new FormData();
      fd.append('participantId', a.participantId);
      fd.append('token', a.token);
      fd.append('turnId', tId);
      fd.append('kind', 'final');
      if (blob && blob.size > 0) fd.append('audio', blob, 'turn');
      try {
        const r = await fetch(`/api/rooms/${a.roomId}/guest/audio`, { method: 'POST', body: fd });
        if (r.ok) {
          const j = (await r.json()) as { text?: string; ok?: boolean };
          if (j.ok && j.text?.trim()) setLiveText(j.text.trim());
        }
      } catch {
        /* live text already saved */
      }
    }
    turnRef.current = null;
    setTurnId(null);
    setState('idle');
  }, [pushLive, releaseStream, setLiveText]);

  useEffect(
    () => () => {
      activeRef.current = false;
      if (pushTimerRef.current) window.clearInterval(pushTimerRef.current);
      try {
        srRef.current?.stop();
      } catch {
        /* ignore */
      }
      releaseStream();
    },
    [releaseStream]
  );

  return { state, live, level, error, turnId, acquire, release: releaseStream, start, stop, setError };
}
