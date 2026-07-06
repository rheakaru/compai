import { NextRequest } from 'next/server';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import type { LeadDocument } from '@/lib/leads/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Full document (with text + version history) for the viewer. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id, docId } = await ctx.params;
  const snap = await adminDb()
    .collection('workshopLeads')
    .doc(id)
    .collection('documents')
    .doc(docId)
    .get();
  if (!snap.exists) return new Response('not found', { status: 404 });
  return Response.json({ document: { id: snap.id, ...(snap.data() as Omit<LeadDocument, 'id'>) } });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id, docId } = await ctx.params;
  const ref = adminDb().collection('workshopLeads').doc(id).collection('documents').doc(docId);
  const snap = await ref.get();
  const path = (snap.data() as LeadDocument | undefined)?.storagePath;
  if (path) await adminBucket().file(path).delete().catch(() => undefined);
  await ref.delete();
  return Response.json({ ok: true });
}
