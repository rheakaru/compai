import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import type { InvoiceStatus } from './invoices';

// Server-only invoice helpers shared across the invoice route files. These
// live here (not in a route.ts) because Next.js App Router route modules may
// only export HTTP-method handlers + config — any other export fails the
// build's route-type check.

export const COL_INVOICES = 'rhaiInvoices';

/**
 * Keep a linked pipeline lead honest — forward-only. A 'sent' invoice marks
 * the lead's invoiceSent checklist item; a 'paid' invoice marks
 * paymentReceived. Never un-sets, so it can't clobber the operator's own
 * toggles.
 */
export async function syncLeadFromInvoice(leadId: string | undefined, status: InvoiceStatus): Promise<void> {
  if (!leadId) return;
  const patch: Record<string, unknown> = {};
  if (status === 'sent' || status === 'paid') patch['checklist'] = { invoiceSent: true };
  if (status === 'paid') patch['paymentReceived'] = true;
  if (Object.keys(patch).length === 0) return;
  try {
    await adminDb()
      .collection('workshopLeads')
      .doc(leadId)
      .set({ ...patch, updatedAt: Date.now() }, { merge: true });
  } catch {
    // lead may have been deleted; invoice tracking is still valid
  }
}
