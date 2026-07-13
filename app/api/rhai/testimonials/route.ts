import { NextRequest } from 'next/server';
import { adminDb, mediaBucket } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { COL_TESTIMONIALS, type Testimonial } from '@/lib/rhai/testimonials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Operator curation of the voice testimonials.
export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const snap = await adminDb().collection(COL_TESTIMONIALS).get();
  const testimonials = snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<Testimonial, 'id'>) }))
    // Shown first (by order), then the rest newest-first.
    .sort((a, b) => {
      if (a.displayed !== b.displayed) return a.displayed ? -1 : 1;
      if (a.displayed) return a.order - b.order || a.createdAt - b.createdAt;
      return b.createdAt - a.createdAt;
    });
  return Response.json({ testimonials });
}

/** PATCH { id, displayed?, order? } — show/hide, or set a single order. */
export async function PATCH(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { id?: string; displayed?: boolean; order?: number };
  if (!body.id) return new Response('expected { id }', { status: 400 });
  const update: Record<string, unknown> = {};
  if (typeof body.displayed === 'boolean') update.displayed = body.displayed;
  if (typeof body.order === 'number') update.order = body.order;
  if (Object.keys(update).length === 0) return new Response('nothing to update', { status: 400 });
  await adminDb().collection(COL_TESTIMONIALS).doc(body.id).set(update, { merge: true });
  return Response.json({ ok: true });
}

/** PUT { orderedIds } — set display order = index across the shown list. */
export async function PUT(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { orderedIds?: string[] };
  if (!Array.isArray(body.orderedIds)) return new Response('expected { orderedIds }', { status: 400 });
  const db = adminDb();
  const batch = db.batch();
  body.orderedIds.slice(0, 200).forEach((id, i) => {
    batch.set(db.collection(COL_TESTIMONIALS).doc(id), { order: i }, { merge: true });
  });
  await batch.commit();
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return new Response('expected ?id', { status: 400 });
  const ref = adminDb().collection(COL_TESTIMONIALS).doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    const path = (snap.data() as Testimonial).storagePath;
    if (path) await mediaBucket().file(path).delete().catch(() => undefined);
    await ref.delete();
  }
  return Response.json({ ok: true });
}
