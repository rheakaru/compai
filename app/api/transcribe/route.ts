import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { adminBucket } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Public transcription endpoint — uploads a short audio clip to ElevenLabs
// Scribe (scribe_v1). Chosen over the browser's built-in SpeechRecognition
// because Scribe is dramatically more accurate on Indian English and
// code-switched Hindi/Kannada/Tamil words. Public by design (mirrors
// /api/interview, /api/discovery): only accepts audio, returns text, nothing
// else. Cap size + duration to keep abuse blast-radius small.

// Chat replies are short clips — a tight cap keeps the unauthenticated
// endpoint's abuse blast-radius (ElevenLabs credits + Storage) small.
const MAX_BYTES = 25 * 1024 * 1024;
const MODEL = 'scribe_v1';

// GET is a lightweight availability probe. Client uses it once on mount to
// decide whether to prefer server-side transcription or fall back to the
// browser's built-in SpeechRecognition.
export async function GET() {
  const available = !!process.env.ELEVENLABS_API_KEY;
  return Response.json({ available, model: MODEL });
}

export async function POST(req: NextRequest) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return new Response('transcription not configured', { status: 503 });

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

  // Language hint. Client sends ISO-639-1 ('en'); Scribe wants ISO-639-3
  // ('eng'). Map the common ones we might see for our audience. `null`/absent
  // lets Scribe auto-detect (still very good on Indian English).
  const rawLang = String(inbound.get('language') || 'en').toLowerCase().slice(0, 5);
  const langCode = ISO_MAP[rawLang] ?? null;

  const out = new FormData();
  const ext = audio.type.includes('mp4')
    ? 'mp4'
    : audio.type.includes('ogg')
      ? 'ogg'
      : audio.type.includes('wav')
        ? 'wav'
        : audio.type.includes('mpeg')
          ? 'mp3'
          : 'webm';
  out.append('file', audio, `speech.${ext}`);
  out.append('model_id', MODEL);
  if (langCode) out.append('language_code', langCode);
  // Cheaper + cleaner text for our use — we don't need timestamps, diarization,
  // or event tags for a chat composer.
  out.append('tag_audio_events', 'false');
  out.append('diarize', 'false');
  out.append('timestamps_granularity', 'none');

  const elevenRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: out
  });

  if (!elevenRes.ok) {
    const body = await elevenRes.text().catch(() => '');
    return new Response(`transcription failed: ${body.slice(0, 300) || elevenRes.status}`, { status: 502 });
  }
  const parsed = (await elevenRes.json()) as { text?: string };
  const text = (parsed.text ?? '').trim();

  // Optional: preserve the original audio so Rhea can hear the guest's actual
  // voice from the transcript, not just the text of what they said. The client
  // passes { sessionKind, sessionId } tying the recording to a specific
  // discovery or interview session. If either is missing / malformed we skip
  // storage and return text only — the endpoint stays useful either way.
  const sessionKind = String(inbound.get('sessionKind') || '').slice(0, 20);
  const sessionId = String(inbound.get('sessionId') || '').slice(0, 64);
  let audioUrl: string | undefined;
  if (
    (sessionKind === 'discovery' || sessionKind === 'interview') &&
    /^[A-Za-z0-9_-]+$/.test(sessionId)
  ) {
    try {
      const bucket = adminBucket();
      const path = `voice/${sessionKind}/${sessionId}/${Date.now()}-${randomUUID()}.${ext}`;
      const file = bucket.file(path);
      const buf = Buffer.from(await audio.arrayBuffer());
      await file.save(buf, {
        contentType: audio.type || 'audio/webm',
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

// ISO-639-1 → ISO-639-3 for the languages we're likely to see. Only including
// what's plausible for this app's audience; anything else auto-detects.
const ISO_MAP: Record<string, string> = {
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
