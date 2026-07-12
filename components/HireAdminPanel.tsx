'use client';

// Operator (Rhea) admin for the Rhai Interviews product: edit pricing —
// globally or per company (differential pricing) — see every company, job,
// and payment, and manually grant entitlements (comps / offline payments).

import { useCallback, useEffect, useState } from 'react';
import { useAuthedFetch } from './useAuthedFetch';
import type { HirePricing } from '@/lib/hire/types';

interface AdminCompany {
  id: string;
  name: string;
  ownerEmail: string;
  createdAt: number;
}
interface AdminJob {
  id: string;
  companyId: string;
  title: string;
  status: string;
  paidJob: boolean;
  paidVia: string | null;
  applicationTier: string;
  applicationsCount: number;
  createdAt: number;
}
interface AdminPayment {
  id: string;
  companyId?: string;
  jobId?: string;
  kind?: string;
  amountInr?: number;
  status?: string;
  createdAt?: number;
}

export function HireAdminPanel() {
  const authedFetch = useAuthedFetch();
  const [pricing, setPricing] = useState<HirePricing | null>(null);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authedFetch('/api/rhai/hire-admin');
    if (res.ok) {
      const d = (await res.json()) as {
        pricing: HirePricing;
        companies: AdminCompany[];
        jobs: AdminJob[];
        payments: AdminPayment[];
      };
      setPricing(d.pricing);
      setCompanies(d.companies);
      setJobs(d.jobs);
      setPayments(d.payments);
    }
  }, [authedFetch]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const savePricing = async () => {
    if (!pricing) return;
    setStatus('Saving…');
    const res = await authedFetch('/api/rhai/hire-admin', { method: 'PUT', body: JSON.stringify(pricing) });
    setStatus(res.ok ? '✓ Saved' : 'Save failed');
    setTimeout(() => setStatus(null), 2000);
  };

  const grant = async (jobId: string, g: string) => {
    await authedFetch('/api/rhai/hire-admin', { method: 'POST', body: JSON.stringify({ jobId, grant: g }) }).catch(() => undefined);
    load().catch(() => undefined);
  };

  if (!pricing) return <p className="text-sm text-ink-400">Loading…</p>;

  const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const field = 'w-28 rounded-md border border-ink-200 px-2 py-1.5 text-sm focus:border-ink-400 focus:outline-none';
  const companyName = (id: string) => companies.find(c => c.id === id)?.name ?? id.slice(0, 8);

  const paidTotal = payments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amountInr ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Pricing */}
      <section className="rounded-lg border border-ink-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="eyebrow">Global pricing (₹)</p>
          <div className="flex items-center gap-2">
            {status && <span className="text-[11px] text-ink-400">{status}</span>}
            <button type="button" onClick={savePricing} className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-600">
              Save pricing
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          {(
            [
              ['jobPrice', 'Per job'],
              ['tier1Price', '10→50 apps'],
              ['tier2Price', '50+ apps'],
              ['freeJobs', 'Free jobs'],
              ['freeApplications', 'Free apps/job']
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="text-xs text-ink-600">
              {label}
              <input
                value={String(pricing[k])}
                onChange={e => setPricing({ ...pricing, [k]: num(e.target.value) })}
                inputMode="numeric"
                className={`${field} mt-1 block w-full`}
              />
            </label>
          ))}
        </div>

        {/* Per-company overrides */}
        <p className="eyebrow mb-2 mt-5">Per-company overrides</p>
        {companies.length === 0 ? (
          <p className="text-xs text-ink-400">No companies yet.</p>
        ) : (
          <div className="space-y-2">
            {companies.map(c => {
              const o = pricing.overrides?.[c.id] ?? {};
              const set = (k: string, v: string) =>
                setPricing({
                  ...pricing,
                  overrides: {
                    ...(pricing.overrides ?? {}),
                    [c.id]: { ...o, [k]: v === '' ? undefined : num(v) }
                  }
                });
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border border-ink-100 px-3 py-2">
                  <span className="min-w-[140px] text-xs font-medium text-ink-800">
                    {c.name} <span className="text-ink-400">· {c.ownerEmail}</span>
                  </span>
                  {(
                    [
                      ['jobPrice', 'job'],
                      ['tier1Price', '10-50'],
                      ['tier2Price', '50+'],
                      ['freeJobs', 'free jobs'],
                      ['freeApplications', 'free apps']
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-1 text-[10px] text-ink-500">
                      {label}
                      <input
                        value={o[k] === undefined ? '' : String(o[k])}
                        onChange={e => set(k, e.target.value)}
                        placeholder="—"
                        inputMode="numeric"
                        className="w-16 rounded border border-ink-200 px-1.5 py-1 text-xs focus:border-ink-400 focus:outline-none"
                      />
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Jobs overview + manual grants */}
      <section className="rounded-lg border border-ink-200 bg-white p-4">
        <p className="eyebrow mb-2">Jobs · {jobs.length}</p>
        {jobs.length === 0 ? (
          <p className="text-xs text-ink-400">None yet.</p>
        ) : (
          <div className="space-y-1.5">
            {jobs.map(j => (
              <div key={j.id} className="flex flex-wrap items-center gap-2 rounded-md border border-ink-100 px-3 py-2 text-xs">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-ink-800">{j.title}</span>
                  <span className="text-ink-400"> · {companyName(j.companyId)} · {j.status} · {j.applicationsCount} apps</span>
                </span>
                <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500">
                  {j.paidJob ? `job:${j.paidVia}` : 'job:unpaid'} · {j.applicationTier}
                </span>
                <span className="flex gap-1">
                  {!j.paidJob && (
                    <button type="button" onClick={() => grant(j.id, 'job')} className="rounded border border-ink-200 px-1.5 py-0.5 text-[10px] text-ink-600 hover:bg-ink-50">
                      grant job
                    </button>
                  )}
                  {j.applicationTier === 'free' && (
                    <button type="button" onClick={() => grant(j.id, 'tier1')} className="rounded border border-ink-200 px-1.5 py-0.5 text-[10px] text-ink-600 hover:bg-ink-50">
                      grant 50
                    </button>
                  )}
                  {j.applicationTier !== 'tier2' && (
                    <button type="button" onClick={() => grant(j.id, 'tier2')} className="rounded border border-ink-200 px-1.5 py-0.5 text-[10px] text-ink-600 hover:bg-ink-50">
                      grant ∞
                    </button>
                  )}
                  <button type="button" onClick={() => grant(j.id, 'revoke')} className="rounded border border-rose-200 px-1.5 py-0.5 text-[10px] text-rose-500 hover:bg-rose-50">
                    revoke
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Payments */}
      <section className="rounded-lg border border-ink-200 bg-white p-4">
        <p className="eyebrow mb-2">
          Payments · {payments.length} {paidTotal > 0 && <span className="text-emerald-700">· ₹{paidTotal.toLocaleString('en-IN')} collected</span>}
        </p>
        {payments.length === 0 ? (
          <p className="text-xs text-ink-400">
            None yet. Razorpay activates once RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set — until then, use manual grants above.
          </p>
        ) : (
          <div className="space-y-1">
            {payments.map(p => (
              <p key={p.id} className="text-xs text-ink-600">
                {p.status === 'paid' ? '✓' : '○'} ₹{(p.amountInr ?? 0).toLocaleString('en-IN')} · {p.kind} · {companyName(p.companyId ?? '')} ·{' '}
                {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
              </p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
