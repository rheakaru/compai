'use client';

// Voice input. Two backends:
//
// 1) Preferred: MediaRecorder + /api/transcribe (Sarvam Saarika, or ElevenLabs
//    Scribe as fallback). Dramatically more accurate on Indian English +
//    code-switched Hindi/Kannada/Tamil words than the browser's built-in
//    recognition. Works cross-browser (Chrome, Safari, Firefox, mobile).
//    Recording is cut into ≤25s segments (Sarvam's sync API caps at 30s) by
//    restarting the recorder on the same stream; segments are transcribed in
//    parallel and joined in order. Single-segment replies also upload the raw
//    audio to Cloud Storage so Rhea can hear the guest's actual voice later.
//
// 2) Fallback: browser SpeechRecognition. Used only when the server endpoint
//    is not configured (probe returns { available: false }) or when
//    MediaRecorder/getUserMedia aren't available. Fixed to only emit new
//    finalised segments — the old implementation re-emitted the whole
//    session every event, which is what made the transcript feel jumbled.
//    This backend never captures audioUrl (no server upload).
//
// UI contract: { listening, supported, toggle, error, lastAudioUrl,
// clearAudio }. Server backend sets lastAudioUrl after each successful
// recording; the composer attaches it to the outgoing message, then calls
// clearAudio() so the next message doesn't accidentally inherit the same
// clip.

import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type Backend = 'server' | 'browser' | 'none';

export interface VoiceContext {
  kind: 'discovery' | 'interview';
  sessionId: string | null;
}

export function useVoice(onText: (text: string) => void, ctx?: VoiceContext) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);
  const backendRef = useRef<Backend>('none');
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const ctxRef = useRef<VoiceContext | undefined>(ctx);
  ctxRef.current = ctx;

  // Browser SR state (fallback)
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  // MediaRecorder state (primary). Recording is cut into ≤SEGMENT_MS segments
  // by restarting the recorder on the same mic stream — each segment is a
  // complete, independently-decodable file, kept under Sarvam's 30s sync limit.
  // On stop, every segment is transcribed and the texts are joined in order.
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]); // chunks of the ACTIVE segment
  const segmentsRef = useRef<Blob[]>([]); // completed segments, in order
  const segTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeningRef = useRef(false); // mirror of `listening` for async closures
  const uploadingRef = useRef(false);
  const SEGMENT_MS = 25_000;

  // Detect what's available. Probe the server endpoint once; if it returns
  // { available: true } AND the browser has getUserMedia+MediaRecorder, use
  // the server path. Otherwise fall back to browser SR.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hasMedia =
        typeof window !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof window.MediaRecorder !== 'undefined';

      let serverAvailable = false;
      if (hasMedia) {
        try {
          const res = await fetch('/api/transcribe', { method: 'GET' });
          if (res.ok) {
            const j = (await res.json()) as { available?: boolean };
            serverAvailable = !!j.available;
          }
        } catch {
          // network hiccup — fall through to browser SR
        }
      }
      if (cancelled) return;

      if (hasMedia && serverAvailable) {
        backendRef.current = 'server';
        setSupported(true);
        return;
      }

      // Fall back to browser SpeechRecognition
      const w = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      };
      const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (!Ctor) {
        backendRef.current = 'none';
        setSupported(false);
        return;
      }
      const rec = new Ctor();
      rec.lang = 'en-IN';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = e => {
        // Correct delta handling: only look at results at/after resultIndex,
        // and only emit finalised ones. The previous version re-joined the
        // entire session's results on every event and appended them to the
        // draft, which is why users saw duplicated / jumbled text.
        let finalDelta = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalDelta += (r[0]?.transcript ?? '') + ' ';
        }
        finalDelta = finalDelta.trim();
        if (finalDelta) onTextRef.current(finalDelta);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recRef.current = rec;
      backendRef.current = 'browser';
      setSupported(true);
    })();
    return () => {
      cancelled = true;
      listeningRef.current = false;
      if (segTimerRef.current) {
        clearTimeout(segTimerRef.current);
        segTimerRef.current = null;
      }
      try {
        recRef.current?.stop();
      } catch {
        // already stopped
      }
      try {
        if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') mediaRecRef.current.stop();
      } catch {
        // already stopped
      }
      stopStream(streamRef.current);
    };
  }, []);

  // Begin a fresh recorder segment on an already-open mic stream.
  const startSegment = useCallback((stream: MediaStream) => {
    const mime = pickMime();
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    mediaRecRef.current = mr;
    chunksRef.current = [];
    mr.ondataavailable = ev => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    mr.start();
  }, []);

  // Stop the active recorder and resolve its accumulated blob (or null).
  const finishSegment = useCallback((): Promise<Blob | null> => {
    const mr = mediaRecRef.current;
    if (!mr) return Promise.resolve(null);
    return new Promise<Blob | null>(resolve => {
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        chunksRef.current = [];
        resolve(blob.size > 0 ? blob : null);
      };
      try {
        if (mr.state !== 'inactive') mr.stop();
        else resolve(null);
      } catch {
        resolve(null);
      }
    });
  }, []);

  // Timer-driven rotation: close the current segment, immediately open the
  // next on the same stream, and re-arm. Guards against firing after stop.
  const rotateSegment = useCallback(async () => {
    if (!listeningRef.current) return;
    const blob = await finishSegment();
    if (blob) segmentsRef.current.push(blob);
    if (!listeningRef.current || !streamRef.current) return;
    startSegment(streamRef.current);
    segTimerRef.current = setTimeout(() => void rotateSegment(), SEGMENT_MS);
  }, [finishSegment, startSegment, SEGMENT_MS]);

  const stopServer = useCallback(async () => {
    if (!mediaRecRef.current) return;
    listeningRef.current = false;
    if (segTimerRef.current) {
      clearTimeout(segTimerRef.current);
      segTimerRef.current = null;
    }

    const last = await finishSegment();
    if (last) segmentsRef.current.push(last);
    stopStream(streamRef.current);
    streamRef.current = null;
    mediaRecRef.current = null;
    setListening(false);

    const segments = segmentsRef.current;
    segmentsRef.current = [];
    if (segments.length === 0) return;
    const single = segments.length === 1;

    uploadingRef.current = true;
    try {
      // Transcribe all segments in parallel; join in original order. Audio is
      // only persisted for a single-segment reply (the message schema carries
      // one audioUrl — a partial clip of a long answer would mislead).
      const c = ctxRef.current;
      const parts = await Promise.all(
        segments.map(async (seg, i) => {
          const form = new FormData();
          form.append('audio', seg, `speech.webm`);
          form.append('language', 'en');
          if (single && c?.sessionId) {
            form.append('sessionKind', c.kind);
            form.append('sessionId', c.sessionId);
          }
          const res = await fetch('/api/transcribe', { method: 'POST', body: form });
          if (!res.ok) return { i, text: '', audioUrl: undefined, ok: false };
          const j = (await res.json()) as { text?: string; audioUrl?: string };
          return { i, text: (j.text ?? '').trim(), audioUrl: j.audioUrl, ok: true };
        })
      );

      if (parts.every(p => !p.ok)) {
        setError('Transcription is unavailable right now — please type instead.');
        return;
      }
      const joined = parts
        .sort((a, b) => a.i - b.i)
        .map(p => p.text)
        .filter(Boolean)
        .join(' ')
        .trim();
      if (joined) onTextRef.current(joined);
      const audioUrl = single ? parts[0]?.audioUrl : undefined;
      if (audioUrl) setLastAudioUrl(audioUrl);
    } catch {
      setError('Transcription failed — please type instead.');
    } finally {
      uploadingRef.current = false;
    }
  }, [finishSegment]);

  const startServer = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;
      segmentsRef.current = [];
      startSegment(stream);
      listeningRef.current = true;
      setListening(true);
      segTimerRef.current = setTimeout(() => void rotateSegment(), SEGMENT_MS);
    } catch {
      setError('Microphone permission was denied.');
      setListening(false);
    }
  }, [startSegment, rotateSegment, SEGMENT_MS]);

  const toggle = useCallback(() => {
    const backend = backendRef.current;
    if (backend === 'none') return;

    if (backend === 'server') {
      if (uploadingRef.current) return;
      if (listening) void stopServer();
      else void startServer();
      return;
    }

    // browser backend
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      try {
        rec.start();
        setListening(true);
      } catch {
        // start() throws if already running
      }
    }
  }, [listening, startServer, stopServer]);

  const clearAudio = useCallback(() => setLastAudioUrl(null), []);

  return { listening, supported, toggle, error, lastAudioUrl, clearAudio };
}

function pickMime(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus'
  ];
  const MR = (typeof window !== 'undefined' ? window.MediaRecorder : undefined) as
    | (typeof window.MediaRecorder & { isTypeSupported?: (t: string) => boolean })
    | undefined;
  if (!MR || !MR.isTypeSupported) return undefined;
  for (const c of candidates) if (MR.isTypeSupported(c)) return c;
  return undefined;
}

function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // ignore
    }
  }
}
