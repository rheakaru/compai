import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { requireFinance } from '@/lib/rhai/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// "Docs people asked for" — demand tracking for custom collateral (a Rhai
// one-pager, a pricing sheet, a case-study PDF…). Each ask increments the
// count; once enough people want the same thing, it graduates from
// idea → drafted → ready and becomes something Rhai proactively sends.

const COL = 'rhaiDocRequests';

export type DocRequestStatus = 'idea' | 'drafted' | 'ready';

export interface DocRequest {
  id: string;
  title: string;
  slug: string; // normalized title, the dedupe key
  count: number;
  /** Who asked — client/company names, newest last. */
  requestedBy: string[];
  status: DocRequestStatus;
  note?: string;
  /** Where the finished doc lives once it exists (link or doc name). */
  docLink?: string;
  createdAt: number;
  updatedAt: number;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function GET(req: NextRequest) {
  const { error } = await requireFinance(req);
  if (error) return error;
  const snap = await adminDb().collection(COL).orderBy('count', 'desc').limit(200).get();
  const requests = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<DocRequest, 'id'>) }));
  return Response.json({ requests });
}

// POST {title, requestedBy?, note?} — create, or +1 an existing request with
// the same normalized title.
export async function POST(req: NextRequest) {
  const { error } = await requireFinance(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    requestedBy?: string;
    note?: string;
  };
  const title = body.title?.trim();
  if (!title) return new Response('title required', { status: 400 });
  const slug = slugify(title);
  const requestedBy = body.requestedBy?.trim();
  const now = Date.now();

  const existing = await adminDb().collection(COL).where('slug', '==', slug).limit(1).get();
  if (!existing.empty) {
    await existing.docs[0].ref.set(
      {
        count: FieldValue.increment(1),
        ...(requestedBy ? { requestedBy: FieldValue.arrayUnion(requestedBy) } : {}),
        ...(body.note?.trim() ? { note: body.note.trim().slice(0, 1000) } : {}),
        updatedAt: now
      },
      { merge: true }
    );
    const updated = await existing.docs[0].ref.get();
    return Response.json({ request: { id: updated.id, ...updated.data() }, incremented: true });
  }

  const record: Omit<DocRequest, 'id'> = {
    title,
    slug,
    count: 1,
    requestedBy: requestedBy ? [requestedBy] : [],
    status: 'idea',
    ...(body.note?.trim() ? { note: body.note.trim().slice(0, 1000) } : {}),
    createdAt: now,
    updatedAt: now
  };
  const ref = await adminDb().collection(COL).add(record);
  return Response.json({ request: { id: ref.id, ...record }, incremented: false });
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireFinance(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as Partial<DocRequest> & { id?: string };
  if (!body.id) return new Response('id required', { status: 400 });
  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  if (typeof body.title === 'string' && body.title.trim()) {
    patch.title = body.title.trim();
    patch.slug = slugify(body.title);
  }
  if (body.status && ['idea', 'drafted', 'ready'].includes(body.status)) patch.status = body.status;
  if (typeof body.note === 'string') patch.note = body.note.slice(0, 1000);
  if (typeof body.docLink === 'string') patch.docLink = body.docLink.slice(0, 500);
  await adminDb().collection(COL).doc(body.id).set(patch, { merge: true });
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireFinance(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return new Response('id required', { status: 400 });
  await adminDb().collection(COL).doc(body.id).delete();
  return Response.json({ ok: true });
}
