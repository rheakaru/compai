import { NextRequest } from 'next/server';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { extractInvoiceFields } from '@/lib/rhai/invoice-extract';
import { todayISO } from '@/lib/rhai/invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const COL_COSTS = 'rhaiCosts';
const MAX_BYTES = 25 * 1024 * 1024;

export interface RhaiCost {
  id: string;
  vendor: string;
  amount: number; // INR, major units
  date: string; // YYYY-MM-DD
  category: string; // travel, software, filings, professional-fees, office, other
  /** GST paid on the cost, if the receipt shows it — input-tax-credit candidates. */
  gstPaid?: number;
  vendorGstin?: string;
  note?: string;
  leadId?: string;
  fileName?: string;
  storagePath?: string;
  mime?: string;
  createdAt: number;
  updatedAt: number;
}

// GET → all costs, newest first.
export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const snap = await adminDb().collection(COL_COSTS).orderBy('date', 'desc').limit(500).get();
  const costs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RhaiCost, 'id'>) }));
  return Response.json({ costs });
}

// POST multipart (file [+ fields]) → upload a receipt; Claude extracts vendor/
// amount/date best-effort. POST JSON → record a cost without a file.
export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const now = Date.now();
  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) return new Response('expected a file', { status: 400 });
    if (file.size > MAX_BYTES) return new Response('file too large (max 25MB)', { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.slice(0, 200);
    const mime = file.type || 'application/octet-stream';

    let extracted: Awaited<ReturnType<typeof extractInvoiceFields>> = {};
    try {
      extracted = await extractInvoiceFields(buffer, mime);
    } catch {
      /* extraction is best-effort */
    }

    const ref = adminDb().collection(COL_COSTS).doc();
    let storagePath: string | undefined = `costDocuments/${ref.id}/${fileName}`;
    try {
      await adminBucket().file(storagePath).save(buffer, { contentType: mime, resumable: false });
    } catch {
      storagePath = undefined;
    }

    const cost: Omit<RhaiCost, 'id'> = {
      vendor: String(form?.get('vendor') ?? '') || extracted.client || '',
      amount: Number(form?.get('amount') ?? 0) || extracted.amount || 0,
      date: String(form?.get('date') ?? '') || extracted.issueDate || todayISO(now),
      category: String(form?.get('category') ?? '') || 'other',
      ...(form?.get('note') ? { note: String(form.get('note')) } : {}),
      fileName,
      ...(storagePath ? { storagePath } : {}),
      mime,
      createdAt: now,
      updatedAt: now
    };
    await ref.set(cost);
    return Response.json({ cost: { id: ref.id, ...cost } });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<RhaiCost>;
  if (!body.vendor?.trim() || !body.amount) {
    return new Response('vendor and amount required', { status: 400 });
  }
  const cost: Omit<RhaiCost, 'id'> = {
    vendor: body.vendor.trim(),
    amount: Number(body.amount),
    date: body.date ?? todayISO(now),
    category: body.category?.trim() || 'other',
    ...(body.gstPaid ? { gstPaid: Number(body.gstPaid) } : {}),
    ...(body.vendorGstin?.trim() ? { vendorGstin: body.vendorGstin.trim() } : {}),
    ...(body.note?.trim() ? { note: body.note.trim() } : {}),
    ...(body.leadId?.trim() ? { leadId: body.leadId.trim() } : {}),
    createdAt: now,
    updatedAt: now
  };
  const ref = await adminDb().collection(COL_COSTS).add(cost);
  return Response.json({ cost: { id: ref.id, ...cost } });
}

// PATCH {id, ...fields} / DELETE {id}
export async function PATCH(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as Partial<RhaiCost> & { id?: string };
  if (!body.id) return new Response('id required', { status: 400 });
  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  for (const k of ['vendor', 'date', 'category', 'note', 'vendorGstin', 'leadId'] as const) {
    if (typeof body[k] === 'string') patch[k] = body[k];
  }
  for (const k of ['amount', 'gstPaid'] as const) {
    if (typeof body[k] === 'number') patch[k] = body[k];
  }
  await adminDb().collection(COL_COSTS).doc(body.id).set(patch, { merge: true });
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return new Response('id required', { status: 400 });
  await adminDb().collection(COL_COSTS).doc(body.id).delete();
  return Response.json({ ok: true });
}
