import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { adminBucket } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Public transcription endpoint. Two providers, chosen at runtime:
//
//  1. Sarvam (Saarika) — PREFERRED when SARVAM_API_KEY is set. Built for Indian
//     English + code-switched Indic speech, and it's where Rhea has credits.
//     Its synchronous endpoint only accepts clips UNDER 30 SECONDS, so the
//     client (components/useVoice.ts) records in ≤25s segments and sends them
//     one at a time — each request here is a single short segment.
//  2. ElevenLabs (Scribe) — fallback when Sarvam isn't configured.
//
// Public by design (mirrors /api/interview, /api/discovery): only accepts
// audio, returns text, nothing else. Caps keep the unauthenticated endpoint's
// abuse blast-radius (provider credits + Storage) small.

const MAX_BYTES = 25 * 1024 * 1024;
const ELEVEN_MODEL = 'scribe_v1';
// saarika:v2.5 is the current Saarika transcription model. Overridable via env
// so it can be repointed (e.g. to saaras:v3) when v2.5 sunsets, no code change.
const SARVAM_MODEL = process.env.SARVAM_STT_MODEL || 'saarika:v2.5';

function sarvamKey() {
  return process.env.SARVAM_API_KEY;
}
function elevenKey() {
  return process.env.ELEVENLABS_API_KEY;
}

// GET is a lightweight availability probe. Client uses it once on mount to
// decide whether to prefer server-side transcription or fall back to the
// browser's built-in SpeechRecognition. (It confirms a provider is
// configured, not that it has credits — a dry account still 502s per request.)
export async function GET() {
  const provider = sarvamKey() ? 'sarvam' : elevenKey() ? 'elevenlabs' : null;
  return Response.json({ available: !!provider, provider, model: provider === 'sarvam' ? SARVAM_MODEL : ELEVEN_MODEL });
}

function extFor(type: string): string {
  return type.includes('mp4')
    ? 'mp4'
    : type.includes('ogg')
      ? 'ogg'
      : type.includes('wav')
        ? 'wav'
        : type.includes('mpeg')
          ? 'mp3'
          : 'webm';
}

interface TranscribeResult {
  ok: boolean;
  text?: string;
  status?: number;
  error?: string;
}

// ---- Sarvam (Saarika) --------------------------------------------------------
async function transcribeSarvam(audio: Blob, ext: string, rawLang: string): Promise<TranscribeResult> {
  const key = sarvamKey()!;
  const out = new FormData();
  out.append('file', audio, `speech.${ext}`);
  out.append('model', SARVAM_MODEL);
  // BCP-47 for our audience; unknown → Sarvam auto-detects. Default en-IN.
  out.append('language_code', SARVAM_LANG[rawLang] ?? 'en-IN');

  const res = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: { 'api-subscription-key': key },
    body: out
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, status: res.status, error: body.slice(0, 300) || String(res.status) };
  }
  const parsed = (await res.json().catch(() => ({}))) as { transcript?: string };
  return { ok: true, text: (parsed.transcript ?? '').trim() };
}

// ---- ElevenLabs (Scribe) -----------------------------------------------------
async function transcribeEleven(audio: Blob, ext: string, rawLang: string): Promise<TranscribeResult> {
  const key = elevenKey()!;
  const out = new FormData();
  out.append('file', audio, `speech.${ext}`);
  out.append('model_id', ELEVEN_MODEL);
  const lang = ELEVEN_LANG[rawLang];
  if (lang) out.append('language_code', lang);
  out.append('tag_audio_events', 'false');
  out.append('diarize', 'false');
  out.append('timestamps_granularity', 'none');

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: out
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, status: res.status, error: body.slice(0, 300) || String(res.status) };
  }
  const parsed = (await res.json().catch(() => ({}))) as { text?: string };
  return { ok: true, text: (parsed.text ?? '').trim() };
}

export async function POST(req: NextRequest) {
  const provider = sarvamKey() ? 'sarvam' : elevenKey() ? 'elevenlabs' : null;
  if (!provider) return new Response('transcription not configured', { status: 503 });

  let inbound: FormData;
  try {
    inbound = await req.formData();
  } catch {
    return new Response('expected multipart/form-data with an "audio" file', { status: 400 });
  }
  const audio = inbound.get('audio');
  if (!(audio instanceof Blob)) return new Response('missing "audio" file field', { status: 400 });
  if (audio.size === 0) return new Response('empty audio', { status: 400 });
  if (audio.size > MAX_BYTES) return new Response('audio too large', { status: 413 });

  const rawLang = String(inbound.get('language') || 'en').toLowerCase().slice(0, 5);
  const ext = extFor(audio.type);

  // Browsers label MediaRecorder output "audio/webm;codecs=opus". Sarvam
  // validates the multipart Content-Type against an exact allow-list, and the
  // ";codecs=…" parameter makes it miss (base "audio/webm" is accepted). Read
  // the bytes once and re-wrap with the bare MIME type — reused for storage.
  const baseType = (audio.type || '').split(';')[0].trim() || 'audio/webm';
  const buf = Buffer.from(await audio.arrayBuffer());
  const cleanAudio = new Blob([buf], { type: baseType });

  const result =
    provider === 'sarvam'
      ? await transcribeSarvam(cleanAudio, ext, rawLang)
      : await transcribeEleven(cleanAudio, ext, rawLang);

  if (!result.ok) {
    // Surface the provider status so the client can tell "out of credits" from
    // a genuine outage, and log the detail server-side.
    console.error(`[transcribe] ${provider} failed (${result.status}): ${result.error}`);
    return new Response(`transcription failed: ${result.error ?? result.status ?? 'unknown'}`, { status: 502 });
  }
  const text = result.text ?? '';

  // Optional: preserve the original audio so Rhea can hear the guest's actual
  // voice from the transcript. The client passes { sessionKind, sessionId }
  // tying the recording to a specific discovery or interview session, and only
  // does so when the whole reply is a single segment (a partial clip for a
  // long, multi-segment answer would mislead). Missing/malformed → text only.
  const sessionKind = String(inbound.get('sessionKind') || '').slice(0, 20);
  const sessionId = String(inbound.get('sessionId') || '').slice(0, 64);
  let audioUrl: string | undefined;
  if ((sessionKind === 'discovery' || sessionKind === 'interview') && /^[A-Za-z0-9_-]+$/.test(sessionId)) {
    try {
      const bucket = adminBucket();
      const path = `voice/${sessionKind}/${sessionId}/${Date.now()}-${randomUUID()}.${ext}`;
      const file = bucket.file(path);
      await file.save(buf, {
        contentType: baseType,
        resumable: false,
        metadata: { cacheControl: 'public, max-age=31536000, immutable' }
      });
      await file.makePublic();
      audioUrl = `https://storage.googleapis.com/${bucket.name}/${path}`;
    } catch {
      // Fail-soft — text-only transcription is still useful.
    }
  }

  return Response.json({ text, audioUrl });
}

// ISO-639-1 → Sarvam BCP-47 codes for the languages we're likely to see.
const SARVAM_LANG: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
  or: 'od-IN',
  unknown: 'unknown'
};

// ISO-639-1 → ElevenLabs ISO-639-3.
const ELEVEN_LANG: Record<string, string> = {
  en: 'eng',
  hi: 'hin',
  kn: 'kan',
  ta: 'tam',
  te: 'tel',
  ml: 'mal',
  mr: 'mar',
  bn: 'ben',
  gu: 'guj',
  pa: 'pan',
  or: 'ori'
};
