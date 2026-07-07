import { NextRequest } from 'next/server';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { COL_INVOICES } from '@/lib/rhai/invoice-server';
import type { RhaiInvoice } from '@/lib/rhai/invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Streams the original uploaded invoice file. Operator-gated — the file lives
// in a server-only Storage path, never a public URL.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;

  const snap = await adminDb().collection(COL_INVOICES).doc(id).get();
  if (!snap.exists) return new Response('not found', { status: 404 });
  const inv = snap.data() as Omit<RhaiInvoice, 'id'>;
  if (!inv.storagePath) return new Response('no file for this invoice', { status: 404 });

  const [buffer] = await adminBucket().file(inv.storagePath).download();
  return new Response(new Uint8Array(buffer), {
    headers: {
      'content-type': inv.mime || 'application/octet-stream',
      'content-disposition': `inline; filename="${(inv.fileName || 'invoice').replace(/"/g, '')}"`
    }
  });
}
