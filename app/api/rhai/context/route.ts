import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { COL_CONTEXT, loadContextSections, requireOperator } from '@/lib/rhai/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  return Response.json({ sections: await loadContextSections() });
}

/** Upsert one section: { id, title?, body }. */
export async function PUT(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as { id?: string; title?: string; body?: string };
  if (!body.id || typeof body.body !== 'string') {
    return new Response('expected { id, body }', { status: 400 });
  }
  const update: Record<string, unknown> = { body: body.body, updatedAt: Date.now() };
  if (body.title) update.title = body.title;
  await adminDb().collection(COL_CONTEXT).doc(body.id).set(update, { merge: true });
  return Response.json({ ok: true });
}
