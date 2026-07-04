import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { COL_PEOPLE, requireOperator } from '@/lib/rhai/server';
import type { PersonLogEntry, RhaiPerson } from '@/lib/rhai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MUTABLE: (keyof RhaiPerson)[] = [
  'name',
  'tier',
  'headline',
  'company',
  'city',
  'phone',
  'links',
  'introducedBy',
  'connections',
  'notes',
  'questions',
  'status',
  'leadId'
];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as Partial<RhaiPerson> & { logNote?: string };
  const ref = adminDb().collection(COL_PEOPLE).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return new Response('not found', { status: 404 });
  const prev = snap.data() as Omit<RhaiPerson, 'id'>;

  const update: Record<string, unknown> = { updatedAt: Date.now() };
  for (const k of MUTABLE) if (k in body) update[k] = body[k];

  // Notes edits append to the intel log so history is never lost.
  if (typeof body.notes === 'string' && body.notes.trim() && body.notes !== prev.notes) {
    const entry: PersonLogEntry = { at: Date.now(), text: body.notes, source: 'rhea' };
    update.notesLog = [...(prev.notesLog ?? []), entry];
  } else if (body.logNote?.trim()) {
    const entry: PersonLogEntry = { at: Date.now(), text: body.logNote.trim(), source: 'rhea' };
    update.notesLog = [...(prev.notesLog ?? []), entry];
  }

  await ref.set(update, { merge: true });
  const fresh = await ref.get();
  return Response.json({ person: { id, ...(fresh.data() as Omit<RhaiPerson, 'id'>) } });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;
  await adminDb().collection(COL_PEOPLE).doc(id).delete();
  return Response.json({ ok: true });
}
