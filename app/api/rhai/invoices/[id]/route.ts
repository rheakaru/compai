import { NextRequest } from 'next/server';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { COL_INVOICES, syncLeadFromInvoice } from '@/lib/rhai/invoice-server';
import {
  todayISO,
  type InvoiceCurrency,
  type InvoiceLineItem,
  type InvoiceStatus,
  type RhaiInvoice
} from '@/lib/rhai/invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES: InvoiceStatus[] = ['draft', 'sent', 'paid', 'cancelled'];

// Only these fields are operator-editable. source/storagePath/timestamps stay
// server-owned.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;
  const ref = adminDb().collection(COL_INVOICES).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return new Response('invoice not found', { status: 404 });
  const current = snap.data() as Omit<RhaiInvoice, 'id'>;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    invoiceNumber: string;
    client: string;
    leadId: string | null;
    leadLabel: string;
    currency: string;
    amount: number;
    lineItems: InvoiceLineItem[];
    issueDate: string;
    dueDate: string | null;
    status: InvoiceStatus;
    paidDate: string | null;
    notes: string;
  }>;

  const now = Date.now();
  const update: Record<string, unknown> = { updatedAt: now };

  if (typeof body.invoiceNumber === 'string') update.invoiceNumber = body.invoiceNumber.trim().slice(0, 60);
  if (typeof body.client === 'string') update.client = body.client.trim().slice(0, 200);
  if (typeof body.leadLabel === 'string') update.leadLabel = body.leadLabel.slice(0, 200);
  if (body.leadId === null) update.leadId = null;
  else if (typeof body.leadId === 'string') update.leadId = body.leadId;
  if (body.currency === 'USD' || body.currency === 'INR') update.currency = body.currency as InvoiceCurrency;
  if (typeof body.amount === 'number' && Number.isFinite(body.amount)) update.amount = body.amount;
  if (Array.isArray(body.lineItems)) update.lineItems = body.lineItems.slice(0, 40);
  if (typeof body.issueDate === 'string') update.issueDate = body.issueDate;
  if (body.dueDate === null) update.dueDate = null;
  else if (typeof body.dueDate === 'string') update.dueDate = body.dueDate;
  if (typeof body.notes === 'string') update.notes = body.notes.slice(0, 1000);

  if (body.status && STATUSES.includes(body.status)) {
    update.status = body.status;
    // Stamp / clear the paid date to match the status unless caller set it.
    if (body.status === 'paid' && current.status !== 'paid' && body.paidDate === undefined) {
      update.paidDate = todayISO(now);
    }
    if (body.status !== 'paid' && body.paidDate === undefined) update.paidDate = null;
  }
  if (body.paidDate === null) update.paidDate = null;
  else if (typeof body.paidDate === 'string') update.paidDate = body.paidDate;

  await ref.set(update, { merge: true });

  // Forward-sync the linked lead when status advances.
  const effectiveStatus = (update.status as InvoiceStatus) ?? current.status;
  const leadId = (update.leadId as string | null | undefined) ?? current.leadId;
  if (typeof leadId === 'string') await syncLeadFromInvoice(leadId, effectiveStatus);

  return Response.json({ ok: true, invoice: { id, ...current, ...update } });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;
  const ref = adminDb().collection(COL_INVOICES).doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    const path = (snap.data() as Omit<RhaiInvoice, 'id'>).storagePath;
    if (path) await adminBucket().file(path).delete().catch(() => undefined);
    await ref.delete();
  }
  return Response.json({ ok: true });
}
