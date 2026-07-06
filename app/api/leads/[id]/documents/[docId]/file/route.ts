import { NextRequest } from 'next/server';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import type { LeadDocument } from '@/lib/leads/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Stream the original uploaded file back (operator-gated — no public URLs).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id, docId } = await ctx.params;

  const snap = await adminDb().collection('workshopLeads').doc(id).collection('documents').doc(docId).get();
  if (!snap.exists) return new Response('not found', { status: 404 });
  const doc = snap.data() as LeadDocument;
  if (!doc.storagePath) return new Response('original not retained', { status: 404 });

  const [buffer] = await adminBucket().file(doc.storagePath).download();
  return new Response(new Uint8Array(buffer), {
    headers: {
      'content-type': doc.mime || 'application/octet-stream',
      'content-disposition': `attachment; filename="${doc.name}"`
    }
  });
}
