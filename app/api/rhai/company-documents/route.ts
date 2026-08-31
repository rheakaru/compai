import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import { requireFinance } from '@/lib/rhai/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// The company statutory-document repository (Accounting → Documents): GST
// certificate, incorporation certificate, PAN, bank letters, and anything else
// worth keeping in one place. Finance/operator scope; files live in the private
// media bucket, streamed back through /file.

const COL = 'rhaiCompanyDocuments';
const MAX_BYTES = 25 * 1024 * 1024;

// Suggested document kinds — freeform is allowed via the "other" input.
const DOC_KINDS = [
  'GST certificate',
  'Certificate of incorporation',
  'PAN card',
  'TAN',
  'MSME / Udyam',
  'Bank letter / cancelled cheque',
  'Board resolution',
  'Address proof',
  'Other'
];

function fileUrl(id: string): string {
  return `/api/rhai/company-documents/file?id=${encodeURIComponent(id)}`;
}

export async function GET(req: NextRequest) {
  const { error } = await requireFinance(req);
  if (error) return error;
  const snap = await adminDb().collection(COL).orderBy('createdAt', 'desc').get();
  const documents = snap.docs.map(d => {
    const v = d.data() as { label?: string; kind?: string; fileName?: string; mime?: string; note?: string; createdAt?: number };
    return {
      id: d.id,
      label: v.label ?? v.fileName ?? 'document',
      kind: v.kind ?? 'Other',
      fileName: v.fileName ?? '',
      mime: v.mime ?? '',
      note: v.note ?? '',
      createdAt: v.createdAt ?? 0,
      url: fileUrl(d.id)
    };
  });
  return Response.json({ documents, kinds: DOC_KINDS });
}

export async function POST(req: NextRequest) {
  const { error } = await requireFinance(req);
  if (error) return error;
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return new Response('expected a file', { status: 400 });
  if (file.size > MAX_BYTES) return new Response('file too large (max 25MB)', { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name.slice(0, 200);
  const mime = file.type || 'application/octet-stream';
  const now = Date.now();
  const ref = adminDb().collection(COL).doc();
  const safe = fileName.replace(/[^A-Za-z0-9._-]+/g, '_');
  const storagePath = `companyDocuments/${ref.id}/${safe}`;
  await adminBucket().file(storagePath).save(buffer, { contentType: mime, resumable: false });

  const doc = {
    label: String(form?.get('label') ?? '').slice(0, 200) || fileName,
    kind: String(form?.get('kind') ?? 'Other').slice(0, 60),
    ...(form?.get('note') ? { note: String(form.get('note')).slice(0, 500) } : {}),
    fileName,
    mime,
    storagePath,
    createdAt: now,
    updatedAt: now
  };
  await ref.set(doc);
  return Response.json({ document: { id: ref.id, ...doc, url: fileUrl(ref.id) } });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireFinance(req);
  if (error) return error;
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return new Response('id required', { status: 400 });
  const ref = adminDb().collection(COL).doc(id);
  const snap = await ref.get();
  const path = (snap.data() as { storagePath?: string } | undefined)?.storagePath;
  if (path) await adminBucket().file(path).delete().catch(() => undefined);
  await ref.delete();
  return Response.json({ ok: true });
}
