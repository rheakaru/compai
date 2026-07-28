import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { adminDb, adminBucket } from '@/lib/firebase/admin';
import { DEFAULT_INTERVIEWS } from '@/lib/rhai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// PUBLIC, SANDBOXED CV upload for a candidate interview. Same posture as
// /api/transcribe: unauthenticated by design, accepts only a file, returns
// only a URL, and caps hard (type + size) to keep abuse blast-radius small.
// The candidate uploads their CV here BEFORE starting; the returned URL is
// passed as candidate.resumeUrl to the `start` action, which requires it.

// Admin-configurable max CV size (MB) via env; default 10 MB.
const MAX_MB = Math.max(1, Number(process.env.INTERVIEW_MAX_CV_MB) || 10);
const MAX_BYTES = MAX_MB * 1024 * 1024;

// Allowed CV types → file extension. Spec: PDF, DOC, DOCX only. PDF renders
// inline in the browser (so Rhea can just click "View CV"); Word docs download.
const TYPE_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
};
const ALLOWED_EXTS = ['pdf', 'doc', 'docx'];

async function interviewExists(slug: string): Promise<boolean> {
  if (DEFAULT_INTERVIEWS.some(d => d.id === slug)) return true;
  return (await adminDb().collection('rhaiInterviews').doc(slug).get()).exists;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!(await interviewExists(slug))) return new Response('not found', { status: 404 });

  let inbound: FormData;
  try {
    inbound = await req.formData();
  } catch {
    return new Response('expected multipart/form-data with a "cv" file', { status: 400 });
  }
  const cv = inbound.get('cv');
  if (!(cv instanceof Blob)) return new Response('missing "cv" file field', { status: 400 });
  if (cv.size === 0) return new Response('The file is empty — please pick your CV again.', { status: 400 });
  if (cv.size > MAX_BYTES) return new Response(`That file is over ${MAX_MB} MB — please upload a smaller CV.`, { status: 413 });

  // Trust the browser-declared MIME loosely, but fall back to the filename
  // extension so a correct file with a blank type still goes through.
  const rawName = (cv as File).name ?? '';
  const nameExt = rawName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const ext = TYPE_EXT[cv.type] ?? (ALLOWED_EXTS.includes(nameExt ?? '') ? nameExt : undefined);
  if (!ext) {
    return new Response('Please upload a PDF, DOC, or DOCX file.', { status: 415 });
  }

  try {
    const bucket = adminBucket();
    const path = `cv/interview/${slug}/${Date.now()}-${randomUUID()}.${ext}`;
    const file = bucket.file(path);
    const buf = Buffer.from(await cv.arrayBuffer());
    await file.save(buf, {
      contentType: cv.type || guessContentType(ext),
      resumable: false,
      // Inline so PDFs/images open in the browser instead of force-downloading.
      metadata: {
        cacheControl: 'private, max-age=31536000, immutable',
        contentDisposition: `inline; filename="${sanitizeName(rawName) || `cv.${ext}`}"`
      }
    });
    await file.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${path}`;
    return Response.json({ url, name: sanitizeName(rawName) || `cv.${ext}` });
  } catch {
    return new Response('Upload failed — please try again.', { status: 502 });
  }
}

function guessContentType(ext: string): string {
  return (
    Object.entries(TYPE_EXT).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream'
  );
}

/** Strip anything but a safe filename for the Content-Disposition header. */
function sanitizeName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, '').trim().slice(0, 100);
}
