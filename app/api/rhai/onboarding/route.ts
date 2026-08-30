import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import { ONBOARDING_TOKEN } from '@/lib/rhai/onboarding';
import { loadOnboardingState, onboardingFileUrl } from '@/lib/rhai/onboarding-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// The intern onboarding state. Token-gated (the URL token IS the credential —
// she uploads PII). Persists progress, voice takeaways (audio + transcript),
// exercise answers, and uploaded documents to rhaiOnboarding/{token}, with the
// files in the private media bucket, streamed back through /file.

const COL = 'rhaiOnboarding';
const MAX_BYTES = 25 * 1024 * 1024;

function ok(token: string | null): boolean {
  return !!token && token === ONBOARDING_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!ok(req.nextUrl.searchParams.get('token'))) return new Response('forbidden', { status: 403 });
  return Response.json(await loadOnboardingState());
}

export async function POST(req: NextRequest) {
  const ctype = req.headers.get('content-type') || '';
  const now = Date.now();
  const ref = adminDb().collection(COL).doc(ONBOARDING_TOKEN);

  if (ctype.includes('application/json')) {
    const body = (await req.json().catch(() => ({}))) as {
      token?: string;
      action?: string;
      milestones?: string[];
      stepId?: string;
      response?: string;
    };
    if (!ok(body.token ?? null)) return new Response('forbidden', { status: 403 });

    if (body.action === 'progress' && Array.isArray(body.milestones)) {
      const clean = body.milestones.map(String).slice(0, 100);
      await ref.set({ progress: clean, updatedAt: now }, { merge: true });
      return Response.json({ ok: true });
    }
    if (body.action === 'exercise' && body.stepId) {
      await ref.set(
        { exercise: { [String(body.stepId)]: String(body.response ?? '').slice(0, 5000) }, updatedAt: now },
        { merge: true }
      );
      return Response.json({ ok: true });
    }
    return new Response('bad action', { status: 400 });
  }

  // Multipart — a voice takeaway (audio + transcript) or a document upload.
  const form = await req.formData().catch(() => null);
  if (!form) return new Response('expected multipart/form-data', { status: 400 });
  if (!ok(String(form.get('token') || ''))) return new Response('forbidden', { status: 403 });

  const kind = String(form.get('kind') || '');
  const file = form.get('file');
  const hasFile = file instanceof Blob && file.size > 0;
  if (hasFile && file.size > MAX_BYTES) return new Response('file too large', { status: 413 });

  if (kind === 'takeaway') {
    const promptId = String(form.get('promptId') || '').replace(/[^a-z0-9-]/gi, '');
    if (!promptId) return new Response('no promptId', { status: 400 });
    // Audio is optional — a transcript-only takeaway is still saved. Only when
    // a real recording is attached do we store it and repoint audioPath.
    const rec: Record<string, unknown> = { transcript: String(form.get('transcript') || '').slice(0, 5000), at: now };
    let url: string | null = null;
    if (hasFile) {
      const mime = file.type || 'audio/webm';
      const ext = mime.includes('mp4') ? 'mp4' : mime.includes('mpeg') ? 'mp3' : mime.includes('ogg') ? 'ogg' : 'webm';
      const path = `onboarding/${ONBOARDING_TOKEN}/takeaways/${promptId}-${randomUUID()}.${ext}`;
      await adminBucket().file(path).save(Buffer.from(await file.arrayBuffer()), { contentType: mime, resumable: false });
      rec.audioPath = path;
      rec.mime = mime;
      url = onboardingFileUrl(path);
    }
    await ref.set({ takeaways: { [promptId]: rec }, updatedAt: now }, { merge: true });
    return Response.json({ ok: true, url });
  }

  if (!hasFile) return new Response('no file', { status: 400 });
  const buf = Buffer.from(await (file as Blob).arrayBuffer());
  const mime = (file as Blob).type || 'application/octet-stream';

  if (kind === 'doc') {
    const docId = String(form.get('docId') || '').replace(/[^a-z0-9-]/gi, '');
    if (!docId) return new Response('no docId', { status: 400 });
    const safeName = (String(form.get('filename') || 'document')).replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120);
    const path = `onboarding/${ONBOARDING_TOKEN}/docs/${docId}-${randomUUID()}-${safeName}`;
    await adminBucket().file(path).save(buf, { contentType: mime, resumable: false });
    await ref.set(
      {
        docs: {
          [docId]: { label: String(form.get('label') || docId).slice(0, 120), filename: safeName, path, mime, at: now }
        },
        updatedAt: now
      },
      { merge: true }
    );
    return Response.json({ ok: true, url: onboardingFileUrl(path) });
  }

  return new Response('bad kind', { status: 400 });
}
