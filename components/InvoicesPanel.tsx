'use client';

// Invoices tab — a tracker for money owed and money in. Two ways invoices
// arrive: created here (optionally from a pipeline lead), or uploaded as a
// PDF/image made elsewhere, whose fields Claude extracts on upload. Linked
// leads get their invoiceSent / paymentReceived flags kept in sync.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { leadValue, type WorkshopLead } from '@/lib/leads/types';
import {
  CURRENCY_SYMBOL,
  INVOICE_STATUS_META,
  addDaysISO,
  effectiveStatus,
  formatMoney,
  todayISO,
  type InvoiceCurrency,
  type InvoiceStatus,
  type RhaiInvoice
} from '@/lib/rhai/invoices';

export function InvoicesPanel() {
  const { user, getToken } = useAuth();
  const [invoices, setInvoices] = useState<RhaiInvoice[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  // JSON authed fetch.
  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const token = await getToken();
      return fetch(path, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        }
      });
    },
    [getToken]
  );

  const load = useCallback(async () => {
    const res = await api('/api/rhai/invoices');
    if (res.ok) setInvoices(((await res.json()) as { invoices: RhaiInvoice[] }).invoices);
  }, [api]);

  useEffect(() => {
    if (!user) return;
    load().catch(() => setErr('Could not load invoices'));
  }, [user, load]);

  const upload = async (file: File) => {
    setUploading(true);
    setErr(null);
    try {
      // Multipart — DON'T set content-type; the browser adds the boundary.
      const token = await getToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/rhai/invoices', {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: fd
      });
      if (!res.ok) throw new Error(await res.text());
      const { invoice, extractedOk } = (await res.json()) as { invoice: RhaiInvoice; extractedOk: boolean };
      setInvoices(prev => [invoice, ...(prev ?? [])]);
      if (!extractedOk) setErr("Uploaded, but I couldn't read the details automatically — fill them in on the card.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const create = async (draft: NewInvoice) => {
    const res = await api('/api/rhai/invoices', { method: 'POST', body: JSON.stringify(draft) });
    if (!res.ok) {
      setErr(await res.text());
      return false;
    }
    const { invoice } = (await res.json()) as { invoice: RhaiInvoice };
    setInvoices(prev => [invoice, ...(prev ?? [])]);
    setCreating(false);
    return true;
  };

  const patch = async (id: string, p: Partial<RhaiInvoice>) => {
    setInvoices(prev => (prev ? prev.map(i => (i.id === id ? { ...i, ...p } : i)) : prev));
    await api(`/api/rhai/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(p) }).catch(() => undefined);
  };

  const remove = async (id: string) => {
    setInvoices(prev => (prev ? prev.filter(i => i.id !== id) : prev));
    await api(`/api/rhai/invoices/${id}`, { method: 'DELETE' }).catch(() => undefined);
  };

  const now = Date.now();

  return (
    <div>
      {invoices && invoices.length > 0 && <SummaryStrip invoices={invoices} nowMs={now} />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCreating(c => !c)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
        >
          {creating ? 'Close' : '+ New invoice'}
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="rounded-md border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60"
          title="Upload a PDF or image of an invoice you made elsewhere — Rhai reads the details."
        >
          {uploading ? 'Reading…' : '↑ Upload invoice'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        {err && <p className="text-xs text-rose-600">{err}</p>}
      </div>

      {creating && <NewInvoiceForm api={api} onCreate={create} onCancel={() => setCreating(false)} />}

      {invoices === null ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : invoices.length === 0 ? (
        <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
          No invoices yet — create one, or upload an invoice you made elsewhere and Rhai will pull out the details.
        </p>
      ) : (
        <div className="space-y-2">
          {invoices.map(inv => (
            <InvoiceCard key={inv.id} inv={inv} nowMs={now} onPatch={patch} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary — outstanding vs paid, split by currency (never sum across them).
// ---------------------------------------------------------------------------

function SummaryStrip({ invoices, nowMs }: { invoices: RhaiInvoice[]; nowMs: number }) {
  const totals = useMemo(() => {
    const out: Record<InvoiceCurrency, number> = { INR: 0, USD: 0 };
    const paid: Record<InvoiceCurrency, number> = { INR: 0, USD: 0 };
    let overdue = 0;
    for (const inv of invoices) {
      const eff = effectiveStatus(inv, nowMs);
      if (eff === 'sent' || eff === 'overdue') out[inv.currency] += inv.amount;
      if (eff === 'overdue') overdue++;
      if (eff === 'paid') paid[inv.currency] += inv.amount;
    }
    return { out, paid, overdue };
  }, [invoices, nowMs]);

  const money = (m: Record<InvoiceCurrency, number>) =>
    (['INR', 'USD'] as InvoiceCurrency[]).filter(c => m[c] > 0).map(c => formatMoney(m[c], c)).join(' + ') || '—';

  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <Stat label="Outstanding" value={money(totals.out)} tone="amber" />
      <Stat label="Paid" value={money(totals.paid)} tone="emerald" />
      <Stat label="Overdue" value={totals.overdue === 0 ? 'None' : `${totals.overdue}`} tone={totals.overdue ? 'rose' : 'ink'} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'amber' | 'emerald' | 'rose' | 'ink' }) {
  const toneCls = {
    amber: 'text-amber-800',
    emerald: 'text-emerald-800',
    rose: 'text-rose-700',
    ink: 'text-ink-900'
  }[tone];
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-2xl tracking-tight ${toneCls}`}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New invoice — optionally seeded from a pipeline lead.
// ---------------------------------------------------------------------------

interface NewInvoice {
  client: string;
  invoiceNumber?: string;
  leadId?: string;
  leadLabel?: string;
  currency: InvoiceCurrency;
  amount: number;
  issueDate: string;
  dueDate?: string;
  notes?: string;
  status: InvoiceStatus;
}

function NewInvoiceForm({
  api,
  onCreate,
  onCancel
}: {
  api: (p: string, i?: RequestInit) => Promise<Response>;
  onCreate: (d: NewInvoice) => Promise<boolean>;
  onCancel: () => void;
}) {
  const today = todayISO(Date.now());
  const [leads, setLeads] = useState<WorkshopLead[] | null>(null);
  const [leadId, setLeadId] = useState('');
  const [client, setClient] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [currency, setCurrency] = useState<InvoiceCurrency>('INR');
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await api('/api/leads');
      if (res.ok) setLeads(((await res.json()) as { leads: WorkshopLead[] }).leads);
    })().catch(() => undefined);
  }, [api]);

  const pickLead = (id: string) => {
    setLeadId(id);
    const lead = leads?.find(l => l.id === id);
    if (lead) {
      setClient(lead.company || lead.person || '');
      if (lead.billing === 'paid') setAmount(String(leadValue(lead)));
    }
  };

  const submit = async () => {
    const amt = Number(amount.replace(/[^0-9.]/g, ''));
    if (!client.trim()) return;
    setSaving(true);
    const lead = leads?.find(l => l.id === leadId);
    const ok = await onCreate({
      client: client.trim(),
      invoiceNumber: invoiceNumber.trim() || undefined,
      leadId: leadId || undefined,
      leadLabel: lead ? [lead.person, lead.company].filter(Boolean).join(' · ') : undefined,
      currency,
      amount: Number.isFinite(amt) ? amt : 0,
      issueDate,
      dueDate: dueDate || undefined,
      notes: notes.trim() || undefined,
      status: 'draft'
    });
    setSaving(false);
    if (!ok) return;
  };

  const field = 'w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-ink-400 focus:outline-none';

  return (
    <div className="mb-5 rounded-lg border border-accent/30 bg-accent-soft/40 p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-500">New invoice</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-ink-600">
          From a lead (optional)
          <select value={leadId} onChange={e => pickLead(e.target.value)} className={`${field} mt-1`}>
            <option value="">— not linked —</option>
            {(leads ?? []).map(l => (
              <option key={l.id} value={l.id}>
                {[l.person, l.company].filter(Boolean).join(' · ') || '(unnamed lead)'}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-600">
          Bill to *
          <input value={client} onChange={e => setClient(e.target.value)} placeholder="Company or person" className={`${field} mt-1`} />
        </label>
        <label className="text-xs text-ink-600">
          Invoice number
          <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="auto if blank" className={`${field} mt-1`} />
        </label>
        <div className="grid grid-cols-[80px_1fr] gap-2">
          <label className="text-xs text-ink-600">
            Currency
            <select value={currency} onChange={e => setCurrency(e.target.value as InvoiceCurrency)} className={`${field} mt-1`}>
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
            </select>
          </label>
          <label className="text-xs text-ink-600">
            Amount
            <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0" className={`${field} mt-1`} />
          </label>
        </div>
        <label className="text-xs text-ink-600">
          Issue date
          <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="text-xs text-ink-600">
          Due date
          <div className="mt-1 flex gap-2">
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={field} />
            <button
              type="button"
              onClick={() => setDueDate(addDaysISO(issueDate, 7))}
              className="shrink-0 rounded-md border border-ink-200 bg-white px-2 text-[11px] text-ink-600 hover:bg-ink-50"
              title="Net 7"
            >
              Net 7
            </button>
          </div>
        </label>
        <label className="text-xs text-ink-600 sm:col-span-2">
          Notes
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Payment terms, TDS note, etc." className={`${field} mt-1`} />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={saving || !client.trim()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {saving ? 'Creating…' : 'Create invoice'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-ink-200 px-4 py-2 text-sm text-ink-600 hover:bg-ink-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invoice card — quick status actions always visible; full edit on expand.
// ---------------------------------------------------------------------------

function InvoiceCard({
  inv,
  nowMs,
  onPatch,
  onDelete
}: {
  inv: RhaiInvoice;
  nowMs: number;
  onPatch: (id: string, p: Partial<RhaiInvoice>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const eff = effectiveStatus(inv, nowMs);
  const meta = INVOICE_STATUS_META[eff];

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.chip}`}>
              {meta.label}
            </span>
            <span className="text-sm font-semibold text-ink-900">{inv.invoiceNumber || '(no number)'}</span>
            {inv.source === 'uploaded' && (
              <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-ink-500">uploaded</span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-700">{inv.client || '(no client)'}</p>
          <p className="mt-0.5 text-[11px] text-ink-400">
            Issued {inv.issueDate}
            {inv.dueDate ? ` · due ${inv.dueDate}` : ''}
            {inv.paidDate ? ` · paid ${inv.paidDate}` : ''}
            {inv.leadLabel ? ` · ${inv.leadLabel}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl tracking-tight text-ink-900">{formatMoney(inv.amount, inv.currency)}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {inv.status !== 'sent' && inv.status !== 'paid' && (
          <button
            type="button"
            onClick={() => onPatch(inv.id, { status: 'sent' })}
            className="rounded-md bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-200"
          >
            Mark sent
          </button>
        )}
        {inv.status !== 'paid' && (
          <button
            type="button"
            onClick={() => onPatch(inv.id, { status: 'paid' })}
            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
          >
            Mark paid
          </button>
        )}
        {inv.status === 'paid' && (
          <button
            type="button"
            onClick={() => onPatch(inv.id, { status: 'sent' })}
            className="rounded-md border border-ink-200 px-3 py-1 text-xs text-ink-500 hover:bg-ink-50"
          >
            Reopen
          </button>
        )}
        {inv.storagePath && (
          <a
            href={`/api/rhai/invoices/${inv.id}/file`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50"
          >
            View file
          </a>
        )}
        <button
          type="button"
          onClick={() => setEditing(e => !e)}
          className="rounded-md border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50"
        >
          {editing ? 'Close' : 'Edit'}
        </button>
        <button
          type="button"
          onClick={() => onDelete(inv.id)}
          className="ml-auto rounded-md px-2 py-1 text-xs text-ink-400 hover:bg-rose-50 hover:text-rose-600"
        >
          Delete
        </button>
      </div>

      {editing && <EditForm inv={inv} onPatch={onPatch} onDone={() => setEditing(false)} />}
    </div>
  );
}

function EditForm({
  inv,
  onPatch,
  onDone
}: {
  inv: RhaiInvoice;
  onPatch: (id: string, p: Partial<RhaiInvoice>) => void;
  onDone: () => void;
}) {
  const [invoiceNumber, setInvoiceNumber] = useState(inv.invoiceNumber);
  const [client, setClient] = useState(inv.client);
  const [currency, setCurrency] = useState<InvoiceCurrency>(inv.currency);
  const [amount, setAmount] = useState(String(inv.amount));
  const [issueDate, setIssueDate] = useState(inv.issueDate);
  const [dueDate, setDueDate] = useState(inv.dueDate ?? '');
  const [status, setStatus] = useState<InvoiceStatus>(inv.status);
  const [notes, setNotes] = useState(inv.notes ?? '');

  const field = 'w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-ink-400 focus:outline-none';

  const save = () => {
    const amt = Number(amount.replace(/[^0-9.]/g, ''));
    onPatch(inv.id, {
      invoiceNumber: invoiceNumber.trim(),
      client: client.trim(),
      currency,
      amount: Number.isFinite(amt) ? amt : 0,
      issueDate,
      dueDate: dueDate || undefined,
      status,
      notes: notes.trim()
    });
    onDone();
  };

  return (
    <div className="mt-3 grid gap-3 rounded-md border border-ink-100 bg-cream-50/60 p-3 sm:grid-cols-2">
      <label className="text-xs text-ink-600">
        Invoice number
        <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className={`${field} mt-1`} />
      </label>
      <label className="text-xs text-ink-600">
        Bill to
        <input value={client} onChange={e => setClient(e.target.value)} className={`${field} mt-1`} />
      </label>
      <div className="grid grid-cols-[80px_1fr] gap-2">
        <label className="text-xs text-ink-600">
          Currency
          <select value={currency} onChange={e => setCurrency(e.target.value as InvoiceCurrency)} className={`${field} mt-1`}>
            <option value="INR">₹ INR</option>
            <option value="USD">$ USD</option>
          </select>
        </label>
        <label className="text-xs text-ink-600">
          Amount ({CURRENCY_SYMBOL[currency]})
          <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" className={`${field} mt-1`} />
        </label>
      </div>
      <label className="text-xs text-ink-600">
        Status
        <select value={status} onChange={e => setStatus(e.target.value as InvoiceStatus)} className={`${field} mt-1`}>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <label className="text-xs text-ink-600">
        Issue date
        <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={`${field} mt-1`} />
      </label>
      <label className="text-xs text-ink-600">
        Due date
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={`${field} mt-1`} />
      </label>
      <label className="text-xs text-ink-600 sm:col-span-2">
        Notes
        <input value={notes} onChange={e => setNotes(e.target.value)} className={`${field} mt-1`} />
      </label>
      {inv.lineItems && inv.lineItems.length > 0 && (
        <div className="sm:col-span-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Line items (from the file)</p>
          <ul className="space-y-0.5 text-xs text-ink-600">
            {inv.lineItems.map((li, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{li.description}</span>
                <span className="shrink-0">{formatMoney(li.amount, inv.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="sm:col-span-2">
        <button type="button" onClick={save} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600">
          Save changes
        </button>
      </div>
    </div>
  );
}
