import { NextRequest } from 'next/server';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { classify, extractText } from '@/lib/rhai/extract';
import type { LeadDocument } from '@/lib/leads/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_BYTES = 25 * 1024 * 1024; // 25MB

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;
  const snap = await adminDb()
    .collection('workshopLeads')
    .doc(id)
    .collection('documents')
    .orderBy('createdAt', 'desc')
    .get();
  // List view omits the (potentially large) text body.
  const documents = snap.docs.map(d => {
    const data = d.data() as Omit<LeadDocument, 'id'>;
    return { id: d.id, ...data, text: undefined, versions: undefined, hasText: !!data.text };
  });
  return Response.json({ documents });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;

  const leadRef = adminDb().collection('workshopLeads').doc(id);
  if (!(await leadRef.get()).exists) return new Response('lead not found', { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return new Response('expected a file', { status: 400 });
  if (file.size > MAX_BYTES) return new Response('file too large (max 25MB)', { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.slice(0, 200);
  const mime = file.type || 'application/octet-stream';

  let text = '';
  try {
    text = await extractText(buffer, name, mime);
  } catch (e) {
    text = `(Couldn't extract text from "${name}": ${e instanceof Error ? e.message : 'error'})`;
  }

  const now = Date.now();
  const docRef = leadRef.collection('documents').doc();

  // Keep the original in Storage for re-download.
  let storagePath: string | undefined;
  try {
    storagePath = `leadDocuments/${id}/${docRef.id}/${name}`;
    await adminBucket().file(storagePath).save(buffer, { contentType: mime, resumable: false });
  } catch {
    storagePath = undefined; // extraction still succeeded; original just not retained
  }

  const doc: Omit<LeadDocument, 'id'> = {
    name,
    origin: 'uploaded',
    kind: classify(name, mime),
    text,
    ...(storagePath ? { storagePath } : {}),
    mime,
    sizeBytes: file.size,
    createdAt: now,
    updatedAt: now
  };
  await docRef.set(doc);
  return Response.json({ document: { id: docRef.id, ...doc, text: undefined, hasText: !!text } });
}
