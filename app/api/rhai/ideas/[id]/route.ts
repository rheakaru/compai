import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { COL_IDEAS, requireOperator } from '@/lib/rhai/server';
import type { RhaiIdea } from '@/lib/rhai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MUTABLE: (keyof RhaiIdea)[] = ['text', 'status', 'extraContext'];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as Partial<RhaiIdea>;
  const update: Record<string, unknown> = { updatedAt: Date.now() };
  for (const k of MUTABLE) if (k in body) update[k] = body[k];

  const ref = adminDb().collection(COL_IDEAS).doc(id);
  if (!(await ref.get()).exists) return new Response('not found', { status: 404 });
  await ref.set(update, { merge: true });
  const fresh = await ref.get();
  return Response.json({ idea: { id: fresh.id, ...(fresh.data() as Omit<RhaiIdea, 'id'>) } });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;
  await adminDb().collection(COL_IDEAS).doc(id).delete();
  return Response.json({ ok: true });
}
