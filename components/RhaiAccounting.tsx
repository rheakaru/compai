'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useAuthedFetch } from './useAuthedFetch';
import {
  COMPLIANCE_CATEGORY_META,
  type ComplianceCategory,
  type ComplianceItem
} from '@/lib/rhai/compliance';
import { formatMoney } from '@/lib/rhai/invoices';

// ---------------------------------------------------------------------------
// Accounting tab — RHAI CONSULTING GROUP PRIVATE LIMITED.
// Sections: Compliance (statutory calendar) · Costs · Travel · New invoice ·
// Company (one-time statutory setup).
// ---------------------------------------------------------------------------

type Section = 'compliance' | 'costs' | 'travel' | 'invoice' | 'company';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'compliance', label: 'Compliance' },
  { id: 'costs', label: 'Costs' },
  { id: 'travel', label: 'Travel' },
  { id: 'invoice', label: 'New invoice' },
  { id: 'company', label: 'Company' }
];

export function RhaiAccounting() {
  const [section, setSection] = useState<Section>('compliance');
  const [gaps, setGaps] = useState<string[]>([]);
  const authedFetch = useAuthedFetch();

  const loadGaps = useCallback(async () => {
    try {
      const res = await authedFetch('/api/rhai/company');
      if (res.ok) setGaps(((await res.json()) as { gaps: string[] }).gaps);
    } catch {
      /* banner is best-effort */
    }
  }, [authedFetch]);

  useEffect(() => {
    void loadGaps();
  }, [loadGaps]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`rounded-full px-3 py-1 text-xs ${
              section === s.id
                ? 'bg-ink-900 text-white'
                : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {gaps.length > 0 && section !== 'company' && (
        <button
          type="button"
          onClick={() => setSection('company')}
          className="block w-full rounded border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900"
        >
          Company setup incomplete — missing {gaps.join(', ')}. Click to fill it in (GST invoices
          are blocked until then).
        </button>
      )}

      {section === 'compliance' && <ComplianceSection />}
      {section === 'costs' && <CostsSection />}
      {section === 'travel' && <TravelSection />}
      {section === 'invoice' && <InvoiceGenerator blocked={gaps.length > 0} />}
      {section === 'company' && <CompanySection onSaved={loadGaps} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compliance
// ---------------------------------------------------------------------------

interface ComplianceRow extends ComplianceItem {
  done: boolean;
  note: string;
}

function ComplianceSection() {
  const authedFetch = useAuthedFetch();
  const [items, setItems] = useState<ComplianceRow[] | null>(null);
  const [fyStart, setFyStart] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidePast, setHidePast] = useState(true);

  const load = useCallback(
    async (fy?: number) => {
      try {
        const res = await authedFetch(`/api/rhai/compliance${fy ? `?fy=${fy}` : ''}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = (await res.json()) as { fyStart: number; items: ComplianceRow[] };
        setItems(d.items);
        setFyStart(d.fyStart);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [authedFetch]
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(id: string, done: boolean) {
    setItems(prev => prev?.map(i => (i.id === id ? { ...i, done } : i)) ?? null);
    await authedFetch('/api/rhai/compliance', {
      method: 'POST',
      body: JSON.stringify({ id, done })
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const grouped = useMemo(() => {
    const rows = (items ?? []).filter(i => !hidePast || i.due >= today || !i.done);
    const byMonth = new Map<string, ComplianceRow[]>();
    for (const i of rows) {
      const key = i.due.slice(0, 7);
      byMonth.set(key, [...(byMonth.get(key) ?? []), i]);
    }
    return [...byMonth.entries()];
  }, [items, hidePast, today]);

  if (error)
    return <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>;
  if (!items) return <p className="text-sm text-ink-500">Loading calendar…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">
          Statutory calendar for FY {fyStart}–{(fyStart ?? 0) + 1} — GST, TDS, income tax, ROC and
          Karnataka filings. An operating checklist, not legal advice; confirm dates with your CA.
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-ink-500">
            <input type="checkbox" checked={hidePast} onChange={e => setHidePast(e.target.checked)} />
            Hide completed past items
          </label>
          <button
            type="button"
            onClick={() => fyStart && load(fyStart + 1)}
            className="rounded-md border border-ink-200 px-2 py-1 text-xs text-ink-600 hover:bg-ink-50"
          >
            Next FY →
          </button>
        </div>
      </div>

      {grouped.map(([month, rows]) => (
        <div key={month}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
            {new Date(`${month}-01T00:00:00`).toLocaleString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
          <div className="space-y-1">
            {rows.map(i => {
              const overdue = !i.done && i.due < today;
              const meta = COMPLIANCE_CATEGORY_META[i.category as ComplianceCategory];
              return (
                <label
                  key={i.id}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 ${
                    i.done ? 'border-ink-100 bg-ink-50/50 opacity-60' : overdue ? 'border-rose-200 bg-rose-50/50' : 'border-ink-200 bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={i.done}
                    onChange={e => toggle(i.id, e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className={`text-sm font-medium ${i.done ? 'line-through' : ''} text-ink-900`}>
                        {i.title}
                      </span>
                      <span className={`rounded-full border px-1.5 py-px text-[10px] ${meta.chip}`}>{meta.label}</span>
                      <span className={`text-[11px] ${overdue ? 'font-semibold text-rose-600' : 'text-ink-400'}`}>
                        due {new Date(`${i.due}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {overdue ? ' — overdue' : ''}
                      </span>
                    </span>
                    <span className="block text-xs text-ink-500">{i.detail}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------

interface Cost {
  id: string;
  vendor: string;
  amount: number;
  date: string;
  category: string;
  gstPaid?: number;
  note?: string;
  fileName?: string;
}

const COST_CATEGORIES = ['travel', 'software', 'filings', 'professional-fees', 'office', 'other'];

function CostsSection() {
  const authedFetch = useAuthedFetch();
  const { getToken } = useAuth();
  const [costs, setCosts] = useState<Cost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ vendor: '', amount: '', date: '', category: 'other', gstPaid: '', note: '' });

  const load = useCallback(async () => {
    try {
      const res = await authedFetch('/api/rhai/costs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCosts(((await res.json()) as { costs: Cost[] }).costs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addCost() {
    if (!form.vendor.trim() || !Number(form.amount)) return;
    setBusy(true);
    try {
      const res = await authedFetch('/api/rhai/costs', {
        method: 'POST',
        body: JSON.stringify({
          vendor: form.vendor,
          amount: Number(form.amount),
          ...(form.date ? { date: form.date } : {}),
          category: form.category,
          ...(Number(form.gstPaid) ? { gstPaid: Number(form.gstPaid) } : {}),
          ...(form.note ? { note: form.note } : {})
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setForm({ vendor: '', amount: '', date: '', category: 'other', gstPaid: '', note: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function uploadReceipt(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      // Raw fetch — authedFetch forces a JSON content-type, which would break
      // the multipart boundary. The browser sets it for FormData.
      const token = await getToken();
      const res = await fetch('/api/rhai/costs', {
        method: 'POST',
        body: fd,
        headers: token ? { authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`Upload failed (HTTP ${res.status})`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const total = (costs ?? []).reduce((s, c) => s + c.amount, 0);
  const gstTotal = (costs ?? []).reduce((s, c) => s + (c.gstPaid ?? 0), 0);

  return (
    <div className="space-y-4">
      {error && <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>}

      <div className="rounded-md border border-ink-200 bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Add a cost</p>
        <div className="grid gap-2 sm:grid-cols-6">
          <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm sm:col-span-2" placeholder="Vendor" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} />
          <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm" placeholder="Amount ₹" inputMode="numeric" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          <select className="rounded-md border border-ink-200 px-2 py-1.5 text-sm" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {COST_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm" placeholder="GST paid ₹ (opt)" inputMode="numeric" value={form.gstPaid} onChange={e => setForm(f => ({ ...f, gstPaid: e.target.value }))} />
          <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm sm:col-span-4" placeholder="Note (optional)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" disabled={busy} onClick={addCost} className="flex-1 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50">
              {busy ? 'Saving…' : 'Add'}
            </button>
            <label className="flex-1 cursor-pointer rounded-md border border-ink-200 px-3 py-1.5 text-center text-sm text-ink-700 hover:bg-ink-50">
              Upload receipt
              <input
                type="file"
                className="hidden"
                accept=".pdf,image/*"
                onChange={e => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void uploadReceipt(f);
                }}
              />
            </label>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-ink-400">Uploading a receipt reads the vendor, amount and date off it automatically.</p>
      </div>

      {costs === null ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : costs.length === 0 ? (
        <p className="text-sm text-ink-500">No costs recorded yet.</p>
      ) : (
        <>
          <p className="text-sm text-ink-600">
            {costs.length} costs · total {formatMoney(total, 'INR')}
            {gstTotal > 0 ? ` · GST paid ${formatMoney(gstTotal, 'INR')} (ITC candidates)` : ''}
          </p>
          <div className="space-y-1">
            {costs.map(c => (
              <div key={c.id} className="flex items-baseline justify-between gap-3 rounded-md border border-ink-200 bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {c.vendor || '(unknown vendor)'}
                    <span className="ml-2 rounded-full border border-ink-200 px-1.5 py-px text-[10px] text-ink-500">{c.category}</span>
                  </p>
                  <p className="text-[11px] text-ink-500">
                    {c.date}
                    {c.note ? ` · ${c.note}` : ''}
                    {c.fileName ? ` · 📎 ${c.fileName}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-medium text-ink-900">{formatMoney(c.amount, 'INR')}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Travel
// ---------------------------------------------------------------------------

interface TravelItem {
  kind: string;
  status: 'needed' | 'requested' | 'booked';
  detail?: string;
  confirmation?: string;
}

interface Trip {
  id: string;
  client: string;
  city?: string;
  startDate?: string;
  endDate?: string;
  purpose?: string;
  items: TravelItem[];
  note?: string;
  done?: boolean;
}

const TRAVEL_STATUS_NEXT: Record<TravelItem['status'], TravelItem['status']> = {
  needed: 'requested',
  requested: 'booked',
  booked: 'needed'
};

const TRAVEL_STATUS_CHIP: Record<TravelItem['status'], string> = {
  needed: 'bg-rose-50 text-rose-700 border-rose-200',
  requested: 'bg-amber-50 text-amber-800 border-amber-200',
  booked: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

function TravelSection() {
  const authedFetch = useAuthedFetch();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ client: '', city: '', startDate: '', endDate: '', purpose: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authedFetch('/api/rhai/travel');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTrips(((await res.json()) as { trips: Trip[] }).trips);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addTrip() {
    if (!form.client.trim()) return;
    setBusy(true);
    try {
      const res = await authedFetch('/api/rhai/travel', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          items: [
            { kind: 'flight', status: 'needed' },
            { kind: 'hotel', status: 'needed' }
          ]
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setForm({ client: '', city: '', startDate: '', endDate: '', purpose: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function patchTrip(id: string, patch: Partial<Trip>) {
    setTrips(prev => prev?.map(t => (t.id === id ? { ...t, ...patch } : t)) ?? null);
    await authedFetch('/api/rhai/travel', { method: 'PATCH', body: JSON.stringify({ id, ...patch }) });
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>}
      <p className="text-sm text-ink-500">
        Clients book your travel and stay for on-site work — track per trip what they still owe you.
        Tap a status chip to advance it (needed → requested → booked). You can also log these from
        WhatsApp: &ldquo;Kothari trip 14–15 Aug, they still owe me flights&rdquo;.
      </p>

      <div className="rounded-md border border-ink-200 bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">New trip</p>
        <div className="grid gap-2 sm:grid-cols-6">
          <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm sm:col-span-2" placeholder="Client" value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} />
          <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm" placeholder="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
          <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
          <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
          <button type="button" disabled={busy} onClick={addTrip} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50">
            {busy ? 'Adding…' : 'Add trip'}
          </button>
          <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm sm:col-span-6" placeholder="Purpose (recce / workshop / build)" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} />
        </div>
      </div>

      {trips === null ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : trips.filter(t => !t.done).length === 0 ? (
        <p className="text-sm text-ink-500">No open trips.</p>
      ) : (
        trips
          .filter(t => !t.done)
          .map(t => (
            <div key={t.id} className="rounded-md border border-ink-200 bg-white px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium text-ink-900">
                  {t.client}
                  {t.city ? ` — ${t.city}` : ''}
                  {t.purpose ? <span className="ml-2 text-xs font-normal text-ink-500">{t.purpose}</span> : null}
                </p>
                <div className="flex items-center gap-2">
                  {(t.startDate || t.endDate) && (
                    <p className="text-[11px] text-ink-400">
                      {t.startDate}
                      {t.endDate ? ` → ${t.endDate}` : ''}
                    </p>
                  )}
                  <button type="button" onClick={() => patchTrip(t.id, { done: true })} className="rounded-md border border-ink-200 px-2 py-0.5 text-[11px] text-ink-500 hover:bg-ink-50">
                    Done
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.items.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    title={item.confirmation || 'Tap to advance status'}
                    onClick={() =>
                      patchTrip(t.id, {
                        items: t.items.map((it, i) =>
                          i === idx ? { ...it, status: TRAVEL_STATUS_NEXT[it.status] } : it
                        )
                      })
                    }
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${TRAVEL_STATUS_CHIP[item.status]}`}
                  >
                    {item.kind}
                    {item.detail ? ` · ${item.detail}` : ''} — {item.status}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const kind = window.prompt('Add item (flight / hotel / cab / train / other):', 'cab');
                    if (!kind) return;
                    void patchTrip(t.id, { items: [...t.items, { kind, status: 'needed' }] });
                  }}
                  className="rounded-full border border-dashed border-ink-300 px-2.5 py-1 text-[11px] text-ink-400 hover:bg-ink-50"
                >
                  + item
                </button>
              </div>
              {t.note && <p className="mt-1.5 text-xs text-ink-500">{t.note}</p>}
            </div>
          ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GST invoice generator
// ---------------------------------------------------------------------------

function InvoiceGenerator({ blocked }: { blocked: boolean }) {
  const authedFetch = useAuthedFetch();
  const [form, setForm] = useState({
    client: '',
    clientGstin: '',
    clientAddress: '',
    description: '',
    amount: ''
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ invoiceNumber: string; url: string; warnings: string[] } | null>(null);

  async function generate() {
    if (!form.client.trim() || !Number(form.amount) || !form.description.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await authedFetch('/api/rhai/invoices/generate', {
        method: 'POST',
        body: JSON.stringify({
          client: form.client,
          ...(form.clientGstin.trim() ? { clientGstin: form.clientGstin.trim() } : {}),
          ...(form.clientAddress.trim() ? { clientAddress: form.clientAddress.trim() } : {}),
          lineItems: [{ description: form.description, amount: Number(form.amount) }]
        })
      });
      const body = (await res.json()) as { error?: string; invoiceNumber?: string; url?: string; warnings?: string[] };
      if (!res.ok || body.error) throw new Error(body.error || `HTTP ${res.status}`);
      setResult({ invoiceNumber: body.invoiceNumber!, url: body.url!, warnings: body.warnings ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-ink-500">
        Generates a GST tax invoice PDF under {`RHAI CONSULTING GROUP PRIVATE LIMITED`} — amounts
        are taxable value; CGST+SGST or IGST is added automatically from the client&apos;s GSTIN
        state. It lands in the Invoices tab as a draft. You can also ask for one on WhatsApp.
      </p>
      {blocked && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Fill in the Company section first — invoice generation needs the GSTIN and bank details.
        </p>
      )}
      <input className="w-full rounded-md border border-ink-200 px-2 py-1.5 text-sm" placeholder="Client legal name (e.g. Kothari Metsol Private Limited)" value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm" placeholder="Client GSTIN (blank = unregistered)" value={form.clientGstin} onChange={e => setForm(f => ({ ...f, clientGstin: e.target.value }))} />
        <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm" placeholder="Taxable amount ₹ (before GST)" inputMode="numeric" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
      </div>
      <textarea className="w-full rounded-md border border-ink-200 px-2 py-1.5 text-sm" rows={3} placeholder={'Line item — first line bold title, rest description.\ne.g. AI Workshop and Build Session\nOne-day workshop with the leadership team…'} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      <textarea className="w-full rounded-md border border-ink-200 px-2 py-1.5 text-sm" rows={2} placeholder="Client billing address (optional but recommended)" value={form.clientAddress} onChange={e => setForm(f => ({ ...f, clientAddress: e.target.value }))} />
      <button type="button" disabled={busy || blocked} onClick={generate} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50">
        {busy ? 'Generating…' : 'Generate GST invoice'}
      </button>
      {error && <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>}
      {result && (
        <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p>
            {result.invoiceNumber} generated —{' '}
            <a href={result.url} target="_blank" rel="noreferrer" className="underline">
              download PDF
            </a>{' '}
            (link valid 1 hour; it&apos;s also saved in the Invoices tab).
          </p>
          {result.warnings.map(w => (
            <p key={w} className="mt-1 text-xs text-amber-800">⚠ {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Company settings
// ---------------------------------------------------------------------------

interface CompanyForm {
  legalName: string;
  gstin: string;
  cin: string;
  pan: string;
  email: string;
  registeredAddress: string;
  invoicePrefix: string;
  sacCode: string;
  gstRatePct: number;
  incorporationDate: string;
  bank: { accountName: string; accountNumber: string; bankName: string; branch: string; ifsc: string };
}

function CompanySection({ onSaved }: { onSaved: () => void }) {
  const authedFetch = useAuthedFetch();
  const [form, setForm] = useState<CompanyForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await authedFetch('/api/rhai/company');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = (await res.json()) as { settings: Partial<CompanyForm> & { bank?: Partial<CompanyForm['bank']> } };
        setForm({
          legalName: d.settings.legalName ?? 'RHAI CONSULTING GROUP PRIVATE LIMITED',
          gstin: d.settings.gstin ?? '',
          cin: d.settings.cin ?? '',
          pan: d.settings.pan ?? '',
          email: d.settings.email ?? '',
          registeredAddress: d.settings.registeredAddress ?? '',
          invoicePrefix: d.settings.invoicePrefix ?? 'RCG',
          sacCode: d.settings.sacCode ?? '998313',
          gstRatePct: d.settings.gstRatePct ?? 18,
          incorporationDate: d.settings.incorporationDate ?? '',
          bank: {
            accountName: d.settings.bank?.accountName ?? '',
            accountNumber: d.settings.bank?.accountNumber ?? '',
            bankName: d.settings.bank?.bankName ?? '',
            branch: d.settings.bank?.branch ?? '',
            ifsc: d.settings.bank?.ifsc ?? ''
          }
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [authedFetch]);

  async function save() {
    if (!form) return;
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const res = await authedFetch('/api/rhai/company', { method: 'POST', body: JSON.stringify(form) });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setSaved(true);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!form) return <p className="text-sm text-ink-500">Loading…</p>;

  const field = (label: string, key: keyof Omit<CompanyForm, 'bank' | 'gstRatePct'>, placeholder = '') => (
    <label className="block text-xs text-ink-500">
      {label}
      <input
        className="mt-0.5 w-full rounded-md border border-ink-200 px-2 py-1.5 text-sm text-ink-900"
        placeholder={placeholder}
        value={form[key] as string}
        onChange={e => setForm(f => (f ? { ...f, [key]: e.target.value } : f))}
      />
    </label>
  );
  const bankField = (label: string, key: keyof CompanyForm['bank']) => (
    <label className="block text-xs text-ink-500">
      {label}
      <input
        className="mt-0.5 w-full rounded-md border border-ink-200 px-2 py-1.5 text-sm text-ink-900"
        value={form.bank[key]}
        onChange={e => setForm(f => (f ? { ...f, bank: { ...f.bank, [key]: e.target.value } } : f))}
      />
    </label>
  );

  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-ink-500">
        One-time statutory setup for the company. Everything here goes verbatim onto your GST
        invoices, so copy it exactly off the incorporation certificate / GST registration.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {field('Legal name', 'legalName')}
        {field('GSTIN', 'gstin', '29XXXXXXXXXXXZX')}
        {field('CIN', 'cin', 'U…KA2026PTC…')}
        {field('Company PAN', 'pan')}
        {field('Email', 'email')}
        {field('Incorporation date (YYYY-MM-DD)', 'incorporationDate', '2026-07-01')}
      </div>
      <label className="block text-xs text-ink-500">
        Registered office address
        <textarea
          className="mt-0.5 w-full rounded-md border border-ink-200 px-2 py-1.5 text-sm text-ink-900"
          rows={2}
          value={form.registeredAddress}
          onChange={e => setForm(f => (f ? { ...f, registeredAddress: e.target.value } : f))}
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-3">
        {field('Invoice prefix', 'invoicePrefix')}
        {field('Default SAC', 'sacCode', '998313')}
        <label className="block text-xs text-ink-500">
          GST rate %
          <input
            className="mt-0.5 w-full rounded-md border border-ink-200 px-2 py-1.5 text-sm text-ink-900"
            inputMode="numeric"
            value={String(form.gstRatePct)}
            onChange={e => setForm(f => (f ? { ...f, gstRatePct: Number(e.target.value) || 18 } : f))}
          />
        </label>
      </div>
      <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Company bank account</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {bankField('Account name', 'accountName')}
        {bankField('Account number', 'accountNumber')}
        {bankField('Bank', 'bankName')}
        {bankField('Branch', 'branch')}
        {bankField('IFSC', 'ifsc')}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" disabled={busy} onClick={save} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50">
          {busy ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-sm text-emerald-700">Saved ✓</span>}
      </div>
      {error && <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>}
    </div>
  );
}
