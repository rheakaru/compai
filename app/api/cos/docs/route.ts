import { NextRequest } from 'next/server';
import { requireCosUser } from '@/lib/cos/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { COL_AGENTS, getOrCreateAgent, saveAndRecompile } from '@/lib/cos/store';
import { MAX_BYTES, MAX_DOCS, acceptable, deleteDocument, ingestDocument } from '@/lib/cos/docs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

// Upload (multipart: file, scope=personal|company) and delete (?id=) documents
// the chief of staff should know. One file per request so a slow phone
// connection only ever retries one file.

export async function POST(req: NextRequest) {
  const user = await requireCosUser(req);
  if (user instanceof Response) return user;
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!form || !(file instanceof File)) return new Response('expected a file', { status: 400 });
  const scope = form.get('scope') === 'company' ? 'company' : 'personal';
  if (!acceptable(file.name)) return new Response('PDF, Word (.docx), text, CSV or Excel files only.', { status: 400 });
  if (file.size > MAX_BYTES) return new Response('That file is over 10 MB — try a smaller version.', { status: 413 });

  const agent = await getOrCreateAgent(user.uid, user.email ?? '', '');
  if (agent.docs.length >= MAX_DOCS) return new Response(`That is ${MAX_DOCS} documents — remove one to add another.`, { status: 429 });

  const doc = await ingestDocument({
    uid: user.uid,
    name: file.name,
    mime: file.type,
    buffer: Buffer.from(await file.arrayBuffer()),
    scope
  });
  // arrayUnion so two uploads finishing together don't drop each other.
  await adminDb().collection(COL_AGENTS).doc(user.uid).update({ docs: FieldValue.arrayUnion(doc) });
  const saved = await saveAndRecompile(user.uid, {});
  return Response.json({ doc, docs: saved.docs });
}

export async function DELETE(req: NextRequest) {
  const user = await requireCosUser(req);
  if (user instanceof Response) return user;
  const id = req.nextUrl.searchParams.get('id') ?? '';
  const agent = await getOrCreateAgent(user.uid, user.email ?? '', '');
  if (!agent.docs.some(d => d.id === id)) return new Response('not found', { status: 404 });
  await deleteDocument(user.uid, id);
  const gone = agent.docs.filter(d => d.id === id);
  await adminDb().collection(COL_AGENTS).doc(user.uid).update({ docs: FieldValue.arrayRemove(...gone) });
  const saved = await saveAndRecompile(user.uid, {});
  return Response.json({ docs: saved.docs });
}
