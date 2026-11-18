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
// While recording (server backend) we also expose:
//   - analyser: a Web Audio AnalyserNode on the mic stream, so the UI can draw
//     a live waveform and the speaker can SEE the mic picking them up;
//   - interim: a live, rough transcript from the browser's own recogniser,
//     shown as a preview while they talk. Only on desktop Chrome/Edge, where
//     running it alongside MediaRecorder is reliable — on phones the two can
//     fight over the mic, so there we show the waveform only. The accurate
//     transcript (Scribe) still lands when they stop;
//   - transcribing: true between stop and the final text arriving.
//
// UI contract: { listening, supported, toggle, error, lastAudioUrl,
// clearAudio, analyser, interim, transcribing, startedAt }. Server backend sets lastAudioUrl after each successful
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
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [interim, setInterim] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const previewRef = useRef<SpeechRecognitionLike | null>(null);
  const previewOnRef = useRef(false);
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
        let pending = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalDelta += (r[0]?.transcript ?? '') + ' ';
          else pending += r[0]?.transcript ?? '';
        }
        finalDelta = finalDelta.trim();
        if (finalDelta) onTextRef.current(finalDelta);
        setInterim(pending.trim());
      };
      rec.onend = () => {
        setListening(false);
        setInterim('');
        setStartedAt(null);
      };
      rec.onerror = () => {
        setListening(false);
        setInterim('');
        setStartedAt(null);
      };
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
      stopPreview();
      void audioCtxRef.current?.close().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live preview recogniser (desktop Chrome/Edge only — see header).
  const startPreview = useCallback(() => {
    if (!canLivePreview()) return;
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    let finalText = '';
    const rec = new Ctor();
    rec.lang = 'en-IN';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = e => {
      let pending = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += (r[0]?.transcript ?? '') + ' ';
        else pending += r[0]?.transcript ?? '';
      }
      setInterim((finalText + pending).trim());
    };
    // Chrome ends recognition after a pause; keep it going while recording.
    rec.onend = () => {
      if (!previewOnRef.current) return;
      try {
        rec.start();
      } catch {
        // gave up — the waveform still shows we are recording
      }
    };
    rec.onerror = () => undefined;
    previewRef.current = rec;
    previewOnRef.current = true;
    try {
      rec.start();
    } catch {
      previewOnRef.current = false;
    }
  }, []);

  const stopPreview = useCallback(() => {
    previewOnRef.current = false;
    try {
      previewRef.current?.stop();
    } catch {
      // already stopped
    }
    previewRef.current = null;
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
    stopPreview();
    streamRef.current = null;
    mediaRecRef.current = null;
    setListening(false);
    setStartedAt(null);
    setAnalyser(null);
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;

    const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
    chunksRef.current = [];
    if (blob.size === 0) {
      setInterim('');
      return;
    }
    // Keep the real recorded audio locally so a consumer can upload/play it
    // even if the transcription backend doesn't hand back a server URL.
    setLastAudioBlob(blob);
    setLastAudioUrl(URL.createObjectURL(blob));

    uploadingRef.current = true;
    setTranscribing(true);
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
      let res = await fetch('/api/transcribe', { method: 'POST', body: form });
      // A room full of people recording at once can trip the provider's
      // concurrency limit (429/5xx). One retry after a short pause covers it.
      if (!res.ok && (res.status === 429 || res.status >= 500)) {
        await new Promise(r => setTimeout(r, 1500));
        res = await fetch('/api/transcribe', { method: 'POST', body: form });
      }
      if (!res.ok) {
        setError('Transcription is unavailable right now — please type instead.');
        return;
      }
      const j = (await res.json()) as { text?: string; audioUrl?: string };
      const text = (j.text ?? '').trim();
      if (text) onTextRef.current(text);
      else setError("Didn't catch anything — check the mic and try again, or type.");
    } catch {
      setError('Transcription failed — please type instead.');
    } finally {
      uploadingRef.current = false;
      setTranscribing(false);
      setInterim('');
    }
  }, [stopPreview]);

  const startServer = useCallback(async () => {
    setError(null);
    // Create the AudioContext synchronously inside the tap — iOS Safari only
    // lets it run if it is born in a user gesture (before any await).
    let ctx: AudioContext | null = null;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        ctx = new AC();
        void ctx.resume().catch(() => undefined);
      }
    } catch {
      ctx = null;
    }
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
      setStartedAt(Date.now());
      setInterim('');
      // Level meter for the waveform. Failure here never blocks recording.
      try {
        if (ctx) {
          const src = ctx.createMediaStreamSource(stream);
          const an = ctx.createAnalyser();
          an.fftSize = 1024;
          an.smoothingTimeConstant = 0.6;
          src.connect(an);
          audioCtxRef.current = ctx;
          setAnalyser(an);
        }
      } catch {
        // no waveform — recording still works
      }
      startPreview();
    } catch {
      void ctx?.close().catch(() => undefined);
      setError('Microphone permission was denied.');
      setListening(false);
    }
  }, [startPreview]);

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
      setStartedAt(null);
      setInterim('');
    } else {
      try {
        rec.start();
        setListening(true);
        setStartedAt(Date.now());
      } catch {
        // start() throws if already running
      }
    }
  }, [listening, startServer, stopServer]);

  const clearAudio = useCallback(() => {
    setLastAudioUrl(null);
    setLastAudioBlob(null);
  }, []);

  return {
    listening,
    supported,
    toggle,
    error,
    lastAudioUrl,
    lastAudioBlob,
    clearAudio,
    analyser,
    interim,
    transcribing,
    startedAt
  };
}

/** Desktop Chrome / Edge: browser recogniser runs reliably next to MediaRecorder. */
function canLivePreview(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  if (mobile) return false;
  const chromium = /Chrome\/|Edg\//.test(ua) && !/OPR\/|Brave/.test(ua);
  return chromium;
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
