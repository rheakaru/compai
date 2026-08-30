'use client';

// Voice input. Two backends:
//
// 1) Preferred: MediaRecorder + /api/transcribe (ElevenLabs Scribe by default,
//    Sarvam Saarika as fallback). Dramatically more accurate on Indian English
//    + code-switched Hindi/Kannada/Tamil words than the browser's built-in
//    recognition. Works cross-browser (Chrome, Safari, Firefox, mobile). Each
//    answer is one continuous recording sent in a single call (no chunking, so
//    no boundary word-drops), and the raw audio is uploaded to Cloud Storage so
//    Rhea can hear the guest's actual voice from the transcript later.
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
  const [lastAudioBlob, setLastAudioBlob] = useState<Blob | null>(null);
  const backendRef = useRef<Backend>('none');
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const ctxRef = useRef<VoiceContext | undefined>(ctx);
  ctxRef.current = ctx;

  // Browser SR state (fallback)
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  // MediaRecorder state (primary). One continuous recording per answer — the
  // whole clip is sent to /api/transcribe in a single call (ElevenLabs Scribe
  // has no duration cap), which keeps accuracy highest (no chunk boundaries).
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const uploadingRef = useRef(false);

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

  const stopServer = useCallback(async () => {
    const mr = mediaRecRef.current;
    if (!mr) return;

    await new Promise<void>(resolve => {
      mr.onstop = () => resolve();
      try {
        if (mr.state !== 'inactive') mr.stop();
        else resolve();
      } catch {
        resolve();
      }
    });
    stopStream(streamRef.current);
    streamRef.current = null;
    mediaRecRef.current = null;
    setListening(false);

    const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
    chunksRef.current = [];
    if (blob.size === 0) return;
    // Keep the real recorded audio locally so a consumer can upload/play it
    // even if the transcription backend doesn't hand back a server URL.
    setLastAudioBlob(blob);
    setLastAudioUrl(URL.createObjectURL(blob));

    uploadingRef.current = true;
    try {
      const form = new FormData();
      form.append('audio', blob, `speech.webm`);
      form.append('language', 'en');
      // Tie the recording to a session so the server can persist the audio.
      const c = ctxRef.current;
      if (c?.sessionId) {
        form.append('sessionKind', c.kind);
        form.append('sessionId', c.sessionId);
      }
      const res = await fetch('/api/transcribe', { method: 'POST', body: form });
      if (!res.ok) {
        setError('Transcription is unavailable right now — please type instead.');
        return;
      }
      const j = (await res.json()) as { text?: string; audioUrl?: string };
      const text = (j.text ?? '').trim();
      if (text) onTextRef.current(text);
    } catch {
      setError('Transcription failed — please type instead.');
    } finally {
      uploadingRef.current = false;
    }
  }, []);

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
      const mime = pickMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = ev => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.start();
      setListening(true);
    } catch {
      setError('Microphone permission was denied.');
      setListening(false);
    }
  }, []);

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

  const clearAudio = useCallback(() => {
    setLastAudioUrl(null);
    setLastAudioBlob(null);
  }, []);

  return { listening, supported, toggle, error, lastAudioUrl, lastAudioBlob, clearAudio };
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
