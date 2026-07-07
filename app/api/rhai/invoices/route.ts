import { NextRequest } from 'next/server';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { extractInvoiceFields } from '@/lib/rhai/invoice-extract';
import { COL_INVOICES, syncLeadFromInvoice } from '@/lib/rhai/invoice-server';
import {
  todayISO,
  type InvoiceCurrency,
  type InvoiceLineItem,
  type InvoiceSource,
  type InvoiceStatus,
  type RhaiInvoice
} from '@/lib/rhai/invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024;

const STATUSES: InvoiceStatus[] = ['draft', 'sent', 'paid', 'cancelled'];

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const snap = await adminDb().collection(COL_INVOICES).orderBy('createdAt', 'desc').get();
  const invoices = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RhaiInvoice, 'id'>) }));
  return Response.json({ invoices });
}

// POST handles both:
//   multipart/form-data (file) → upload an invoice made elsewhere; Claude
//     extracts the fields and we create a draft the operator can correct.
//   application/json → create a platform invoice (from a lead or from scratch).
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

    let extracted;
    try {
      extracted = await extractInvoiceFields(buffer, mime);
    } catch {
      extracted = {};
    }

    const ref = adminDb().collection(COL_INVOICES).doc();
    let storagePath: string | undefined;
    try {
      storagePath = `invoices/${ref.id}/${fileName}`;
      await adminBucket().file(storagePath).save(buffer, { contentType: mime, resumable: false });
    } catch {
      storagePath = undefined;
    }

    const invoice: Omit<RhaiInvoice, 'id'> = {
      source: 'uploaded',
      invoiceNumber: extracted.invoiceNumber ?? '',
      client: extracted.client ?? '',
      currency: extracted.currency ?? 'INR',
      amount: extracted.amount ?? 0,
      ...(extracted.lineItems ? { lineItems: extracted.lineItems } : {}),
      issueDate: extracted.issueDate ?? todayISO(now),
      ...(extracted.dueDate ? { dueDate: extracted.dueDate } : {}),
      status: 'draft',
      ...(extracted.notes ? { notes: extracted.notes } : {}),
      fileName,
      ...(storagePath ? { storagePath } : {}),
      mime,
      createdAt: now,
      updatedAt: now
    };
    await ref.set(invoice);
    return Response.json({
      invoice: { id: ref.id, ...invoice },
      extractedOk: Object.keys(extracted).length > 0
    });
  }

  // ---- JSON create (platform invoice) ----
  const body = (await req.json().catch(() => ({}))) as {
    invoiceNumber?: string;
    client?: string;
    leadId?: string;
    leadLabel?: string;
    currency?: string;
    amount?: number;
    lineItems?: InvoiceLineItem[];
    issueDate?: string;
    dueDate?: string;
    status?: InvoiceStatus;
    notes?: string;
    source?: InvoiceSource;
  };

  const client = body.client?.trim();
  if (!client) return new Response('client is required', { status: 400 });
  const amount = typeof body.amount === 'number' && Number.isFinite(body.amount) ? body.amount : 0;
  const currency: InvoiceCurrency = body.currency === 'USD' ? 'USD' : 'INR';
  const status: InvoiceStatus = STATUSES.includes(body.status as InvoiceStatus) ? body.status! : 'draft';

  const invoice: Omit<RhaiInvoice, 'id'> = {
    source: body.source === 'uploaded' ? 'uploaded' : 'platform',
    invoiceNumber: body.invoiceNumber?.trim() || autoNumber(now),
    client: client.slice(0, 200),
    ...(body.leadId ? { leadId: body.leadId, leadLabel: body.leadLabel?.slice(0, 200) ?? '' } : {}),
    currency,
    amount,
    ...(body.lineItems?.length ? { lineItems: body.lineItems.slice(0, 40) } : {}),
    issueDate: body.issueDate || todayISO(now),
    ...(body.dueDate ? { dueDate: body.dueDate } : {}),
    status,
    ...(body.notes?.trim() ? { notes: body.notes.trim().slice(0, 1000) } : {}),
    createdAt: now,
    updatedAt: now
  };
  const ref = await adminDb().collection(COL_INVOICES).add(invoice);

  await syncLeadFromInvoice(invoice.leadId, status);
  return Response.json({ invoice: { id: ref.id, ...invoice } });
}

function autoNumber(nowMs: number): string {
  const d = new Date(nowMs + 5.5 * 3600_000);
  const ym = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const rand = Math.floor(1000 + (nowMs % 9000));
  return `INV-${ym}-${rand}`;
}
