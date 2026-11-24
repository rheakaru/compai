import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { adminDb, mediaBucket } from '@/lib/firebase/admin';
import { transcribeAudioDetailed } from '@/lib/media/scribe';
import { checkTestimonial } from '@/lib/rhai/testimonial-check';
import { passCookie, recordSignup } from '@/lib/cos-workshop/server';
import { isEmail, requestMeta } from '@/lib/shared-docs/server';
import { COL_TESTIMONIALS, type Testimonial } from '@/lib/rhai/testimonials';
import { listPublicTestimonials } from '@/lib/rhai/testimonials-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_BYTES = 20 * 1024 * 1024; // ~ several minutes of compressed audio

// PUBLIC. GET returns only the testimonials Rhea has approved (for the
// homepage voice wall). POST accepts a voice note + name/role, transcribes it,
// stores the audio, and files it UNPUBLISHED — nothing appears on the site
// until Rhea toggles it on from the dashboard, so there's no public-junk risk.
// Every note is checked for junk first (empty, mic tests, gibberish) and sent
// back for a re-record if it fails; a genuine one also sets the pass cookie
// that unlocks /chief-of-staff-workshop.

export async function GET() {
  return Response.json({ testimonials: await listPublicTestimonials() });
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return new Response('expected multipart/form-data', { status: 400 });

  const audio = form.get('audio');
  const name = String(form.get('name') ?? '').trim().slice(0, 80);
  const role = String(form.get('role') ?? '').trim().slice(0, 100);
  const durationSec = Number(form.get('durationSec')) || undefined;
  const email = String(form.get('email') ?? '').trim().slice(0, 254);
  const source = String(form.get('source') ?? '').trim().slice(0, 40);

  if (name.length < 2) return new Response('Please add your name.', { status: 400 });
  if (!(audio instanceof Blob) || audio.size === 0) return new Response('No recording received — please record again.', { status: 400 });
  if (source === 'cos-workshop' && !isEmail(email)) return new Response('Please add your email.', { status: 400 });
  if (audio.size > MAX_BYTES) return new Response('That recording is too long — keep it under a few minutes.', { status: 413 });

  const buffer = Buffer.from(await audio.arrayBuffer());
  const mime = audio.type || 'audio/webm';
  const ext = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : mime.includes('mpeg') ? 'mp3' : mime.includes('wav') ? 'wav' : 'webm';

  // Transcribe from a fresh Blob built off the buffer we already read — avoids
  // a second read of the stream-backed formData Blob. Then check it's a real
  // testimonial before storing anything. If transcription itself is down we
  // can't judge, so the note is let through (and marked unchecked).
  const scribed = await transcribeAudioDetailed(new Blob([buffer], { type: mime }), `testimonial.${ext}`);
  const transcript = scribed.text;
  const verdict = scribed.ok ? await checkTestimonial(transcript, durationSec) : { genuine: true, reason: '', by: 'fail-open' as const };
  if (!verdict.genuine) return new Response(verdict.reason, { status: 422 });

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

  const doc: Omit<Testimonial, 'id'> = {
    name,
    ...(role ? { role } : {}),
    audioUrl: `/api/testimonial/${ref.id}/audio`,
    storagePath,
    mime,
    transcript,
    ...(durationSec ? { durationSec: Math.round(durationSec) } : {}),
    ...(email && isEmail(email) ? { email: email.toLowerCase() } : {}),
    ...(source ? { source } : {}),
    check: { genuine: true, by: verdict.by, transcribed: scribed.ok },
    displayed: false,
    order: 0,
    createdAt: Date.now()
  };
  await ref.set(doc);
  if (email && isEmail(email)) await recordSignup(email, { ...requestMeta(req), testimonialId: ref.id }).catch(() => undefined);
  return new Response(JSON.stringify({ ok: true, unlocked: true }), {
    headers: { 'content-type': 'application/json', 'set-cookie': passCookie(ref.id) }
  });
}
