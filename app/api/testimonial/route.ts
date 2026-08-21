import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { adminDb, mediaBucket } from '@/lib/firebase/admin';
import { transcribeAudio } from '@/lib/media/scribe';
import { COL_TESTIMONIALS, type PublicTestimonial, type Testimonial } from '@/lib/rhai/testimonials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_BYTES = 20 * 1024 * 1024; // ~ several minutes of compressed audio

// PUBLIC. GET returns only the testimonials Rhea has approved (for the
// homepage voice wall). POST accepts a voice note + name/role, transcribes it,
// stores the audio, and files it UNPUBLISHED — nothing appears on the site
// until Rhea toggles it on from the dashboard, so there's no public-junk risk.

/** Cache-busted stream URL — see the note in the mapper below. */
function audioUrlFor(t: Testimonial & { id: string }): string {
  const base = t.audioUrl || `/api/testimonial/${t.id}/audio`;
  if (!t.storagePath) return base;
  // Short stable digest of the object path; no crypto needed, this is a cache
  // key rather than a secret.
  let h = 0;
  for (let i = 0; i < t.storagePath.length; i++) h = (Math.imul(31, h) + t.storagePath.charCodeAt(i)) | 0;
  return `${base}${base.includes('?') ? '&' : '?'}v=${(h >>> 0).toString(36)}`;
}

export async function GET() {
  const snap = await adminDb()
    .collection(COL_TESTIMONIALS)
    .where('displayed', '==', true)
    .get();
  const testimonials: PublicTestimonial[] = snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<Testimonial, 'id'>) }))
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
    .map(t => ({
      id: t.id,
      name: t.name,
      ...(t.role ? { role: t.role } : {}),
      // The audio route is cached immutable for a year on a stable URL, so a
      // re-encoded file would otherwise keep serving the old bytes from the
      // CDN. Version the URL by the storage path: it changes whenever the
      // object does, and stays put when it doesn't.
      audioUrl: audioUrlFor(t),
      transcript: t.transcript
    }));
  return Response.json({ testimonials });
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return new Response('expected multipart/form-data', { status: 400 });

  const audio = form.get('audio');
  const name = String(form.get('name') ?? '').trim().slice(0, 80);
  const role = String(form.get('role') ?? '').trim().slice(0, 100);
  const durationSec = Number(form.get('durationSec')) || undefined;

  if (name.length < 2) return new Response('Please add your name.', { status: 400 });
  if (!(audio instanceof Blob) || audio.size === 0) return new Response('No recording received — please record again.', { status: 400 });
  if (audio.size > MAX_BYTES) return new Response('That recording is too long — keep it under a few minutes.', { status: 413 });

  const buffer = Buffer.from(await audio.arrayBuffer());
  const mime = audio.type || 'audio/webm';
  const ext = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : mime.includes('mpeg') ? 'mp3' : mime.includes('wav') ? 'wav' : 'webm';

  const ref = adminDb().collection(COL_TESTIMONIALS).doc();

  // Store the audio in the media bucket (served via the streaming route — no
  // public-object ACL needed, which the bucket's uniform access wouldn't allow).
  let storagePath = '';
  try {
    storagePath = `testimonials/${ref.id}/${Date.now()}-${randomUUID()}.${ext}`;
    await mediaBucket()
      .file(storagePath)
      .save(buffer, {
        contentType: mime,
        resumable: false,
        metadata: { cacheControl: 'public, max-age=31536000, immutable' }
      });
  } catch {
    return new Response('Could not save your recording — please try again.', { status: 500 });
  }

  // Transcribe from a fresh Blob built off the buffer we already read — avoids
  // a second read of the stream-backed formData Blob. (Currently returns '' if
  // the ElevenLabs account is out of credits; the recording still saves fine.)
  const transcript = await transcribeAudio(new Blob([buffer], { type: mime }), `testimonial.${ext}`);

  const doc: Omit<Testimonial, 'id'> = {
    name,
    ...(role ? { role } : {}),
    audioUrl: `/api/testimonial/${ref.id}/audio`,
    storagePath,
    mime,
    transcript,
    ...(durationSec ? { durationSec: Math.round(durationSec) } : {}),
    displayed: false,
    order: 0,
    createdAt: Date.now()
  };
  await ref.set(doc);
  return Response.json({ ok: true });
}
