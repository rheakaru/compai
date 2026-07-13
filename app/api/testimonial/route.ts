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

export async function GET() {
  const snap = await adminDb()
    .collection(COL_TESTIMONIALS)
    .where('displayed', '==', true)
    .get();
  const testimonials: PublicTestimonial[] = snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<Testimonial, 'id'>) }))
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
    .map(t => ({ id: t.id, name: t.name, ...(t.role ? { role: t.role } : {}), audioUrl: t.audioUrl, transcript: t.transcript }));
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

  const transcript = await transcribeAudio(buffer, `testimonial.${ext}`, mime);

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
