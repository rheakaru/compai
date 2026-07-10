import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import type { RhaiTask } from '@/lib/rhai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET one task — for the task detail page. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;
  const snap = await adminDb().collection('rhaiTasks').doc(id).get();
  if (!snap.exists) return new Response('not found', { status: 404 });
  return Response.json({ task: { id, ...(snap.data() as Omit<RhaiTask, 'id'>) } });
}
