// Invoice tracker types + pure helpers. Client-safe (no server-only or SDK
// imports) so the Invoices panel and the API routes share one source of truth.
//
// Two sources of invoices:
//   'platform' — created inside Rhai (from a lead, or from scratch)
//   'uploaded' — a PDF/image of an invoice made elsewhere (Zoho, Word…),
//                whose fields Claude extracts on upload.

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';
export type InvoiceCurrency = 'INR' | 'USD';
export type InvoiceSource = 'platform' | 'uploaded';

export interface InvoiceLineItem {
  description: string;
  quantity?: number;
  rate?: number;
  amount: number;
}

export interface RhaiInvoice {
  id: string;
  source: InvoiceSource;
  invoiceNumber: string;
  client: string; // who's billed — company or person
  leadId?: string; // optional link to a pipeline lead
  leadLabel?: string;
  currency: InvoiceCurrency;
  amount: number; // total, in major units (rupees / dollars)
  lineItems?: InvoiceLineItem[];
  issueDate: string; // 'YYYY-MM-DD'
  dueDate?: string; // 'YYYY-MM-DD'
  status: InvoiceStatus;
  paidDate?: string; // 'YYYY-MM-DD' — set when marked paid
  notes?: string;
  // uploaded-source original file, streamed back via the operator-gated file route
  fileName?: string;
  storagePath?: string;
  mime?: string;
  createdAt: number;
  updatedAt: number;
}

/** What Claude pulls out of an uploaded invoice. All fields best-effort. */
export interface ExtractedInvoice {
  invoiceNumber?: string;
  client?: string;
  amount?: number;
  currency?: InvoiceCurrency;
  issueDate?: string;
  dueDate?: string;
  lineItems?: InvoiceLineItem[];
  notes?: string;
}

// Effective status folds in "overdue" — a sent invoice past its due date. We
// don't store it (dates move); we derive it for display + summary counts.
export type EffectiveStatus = InvoiceStatus | 'overdue';

export function effectiveStatus(inv: Pick<RhaiInvoice, 'status' | 'dueDate'>, nowMs: number): EffectiveStatus {
  if (inv.status === 'sent' && inv.dueDate) {
    const due = new Date(`${inv.dueDate}T23:59:59`).getTime();
    if (!Number.isNaN(due) && due < nowMs) return 'overdue';
  }
  return inv.status;
}

/** Outstanding = billed but not yet paid (and not a draft/cancelled). */
export function isOutstanding(inv: Pick<RhaiInvoice, 'status'>): boolean {
  return inv.status === 'sent';
}

export const INVOICE_STATUS_META: Record<EffectiveStatus, { label: string; chip: string }> = {
  draft: { label: 'Draft', chip: 'bg-ink-100 text-ink-600' },
  sent: { label: 'Sent', chip: 'bg-amber-100 text-amber-800' },
  overdue: { label: 'Overdue', chip: 'bg-rose-100 text-rose-700' },
  paid: { label: 'Paid', chip: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelled', chip: 'bg-ink-100 text-ink-400 line-through' }
};

export const CURRENCY_SYMBOL: Record<InvoiceCurrency, string> = { INR: '₹', USD: '$' };

export function formatMoney(amount: number, currency: InvoiceCurrency): string {
  const n = Math.round(amount || 0);
  const locale = currency === 'USD' ? 'en-US' : 'en-IN';
  return `${CURRENCY_SYMBOL[currency]}${n.toLocaleString(locale)}`;
}

/** Today as 'YYYY-MM-DD' in IST — for issue-date defaults. */
export function todayISO(nowMs: number): string {
  // IST is UTC+5:30; shift then take the date part.
  return new Date(nowMs + 5.5 * 3600_000).toISOString().slice(0, 10);
}

/** N days after a 'YYYY-MM-DD' date, as 'YYYY-MM-DD'. */
export function addDaysISO(iso: string, days: number): string {
  const base = new Date(`${iso}T00:00:00Z`).getTime();
  if (Number.isNaN(base)) return iso;
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}
