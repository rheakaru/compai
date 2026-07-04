import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import type { RhaiTask } from '@/lib/rhai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COL_TASKS = 'rhaiTasks';

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const snap = await adminDb().collection(COL_TASKS).orderBy('createdAt', 'desc').limit(100).get();
  return Response.json({ tasks: snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RhaiTask, 'id'>) })) });
}

export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as Partial<RhaiTask>;
  const title = body.title?.trim();
  const detail = body.detail?.trim() || title;
  if (!title) return new Response('expected { title }', { status: 400 });

  const task: Omit<RhaiTask, 'id'> = {
    title: title.slice(0, 200),
    detail: (detail ?? '').slice(0, 2000),
    ...(body.leadId ? { leadId: body.leadId } : {}),
    ...(body.leadLabel ? { leadLabel: body.leadLabel.slice(0, 120) } : {}),
    ...(body.skillId ? { skillId: body.skillId } : {}),
    ...(body.appendToNotes ? { appendToNotes: true } : {}),
    status: 'queued',
    createdAt: Date.now()
  };
  const ref = await adminDb().collection(COL_TASKS).add(task);
  return Response.json({ task: { id: ref.id, ...task } });
}

/** PATCH { id, ...fields } — status tweaks, deletes handled via status. */
export async function PATCH(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { id?: string; status?: string; delete?: boolean };
  if (!body.id) return new Response('expected { id }', { status: 400 });
  const ref = adminDb().collection(COL_TASKS).doc(body.id);
  if (body.delete) {
    await ref.delete();
    return Response.json({ ok: true });
  }
  if (body.status) await ref.set({ status: body.status }, { merge: true });
  return Response.json({ ok: true });
}
