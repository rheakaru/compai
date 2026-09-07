import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireHire } from '@/lib/rhai/server';
import { loadHirePricing } from '@/lib/hire/server';
import {
  COL_HIRE_COMPANIES,
  COL_HIRE_JOBS,
  COL_HIRE_PAYMENTS,
  DOC_HIRE_PRICING,
  type HireCompany,
  type HireJob,
  type HirePricing,
  type HirePricingBase
} from '@/lib/hire/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Operator (Rhea) admin for the Rhai Interviews product: pricing (global +
// per-company overrides), an overview of companies/jobs/payments, and manual
// entitlement grants (useful until Razorpay is live, and for comps).

export async function GET(req: NextRequest) {
  const { error } = await requireHire(req);
  if (error) return error;
  const db = adminDb();
  const [pricing, companiesSnap, jobsSnap, paymentsSnap] = await Promise.all([
    loadHirePricing(),
    db.collection(COL_HIRE_COMPANIES).limit(200).get(),
    db.collection(COL_HIRE_JOBS).limit(500).get(),
    db.collection(COL_HIRE_PAYMENTS).limit(200).get()
  ]);
  const companies = companiesSnap.docs
    .map(d => {
      const c = d.data() as HireCompany;
      return { id: d.id, name: c.name, ownerEmail: c.ownerEmail, createdAt: c.createdAt };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
  const jobs = jobsSnap.docs
    .map(d => {
      const j = d.data() as HireJob;
      return {
        id: d.id,
        companyId: j.companyId,
        title: j.title,
        status: j.status,
        paidJob: j.paidJob,
        paidVia: j.paidVia ?? null,
        applicationTier: j.applicationTier,
        applicationsCount: j.applicationsCount ?? 0,
        createdAt: j.createdAt
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
  const payments = paymentsSnap.docs
    .map(d => ({ id: d.id, ...(d.data() as { createdAt?: number } & Record<string, unknown>) }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return Response.json({ pricing, companies, jobs, payments });
}

/** PUT — save pricing (global fields + per-company overrides). */
export async function PUT(req: NextRequest) {
  const { error } = await requireHire(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as Partial<HirePricing>;

  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
  };
  const current = await loadHirePricing();
  const next: HirePricing = {
    jobPrice: num(body.jobPrice, current.jobPrice),
    tier1Price: num(body.tier1Price, current.tier1Price),
    tier2Price: num(body.tier2Price, current.tier2Price),
    freeJobs: num(body.freeJobs, current.freeJobs),
    freeApplications: num(body.freeApplications, current.freeApplications),
    overrides: sanitizeOverrides(body.overrides ?? current.overrides)
  };
  await adminDb().doc(DOC_HIRE_PRICING).set(next);
  return Response.json({ pricing: next });
}

/** POST { jobId, grant } — manual entitlement: 'job' | 'tier1' | 'tier2' | 'revoke'. */
export async function POST(req: NextRequest) {
  const { error } = await requireHire(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { jobId?: string; grant?: string };
  if (!body.jobId || !body.grant || !['job', 'tier1', 'tier2', 'revoke'].includes(body.grant))
    return new Response('expected { jobId, grant }', { status: 400 });

  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  if (body.grant === 'job') {
    patch.paidJob = true;
    patch.paidVia = 'manual';
  } else if (body.grant === 'revoke') {
    patch.paidJob = false;
    patch.paidVia = null;
    patch.applicationTier = 'free';
  } else {
    patch.applicationTier = body.grant;
  }
  await adminDb().collection(COL_HIRE_JOBS).doc(body.jobId).set(patch, { merge: true });
  return Response.json({ ok: true });
}

function sanitizeOverrides(o: HirePricing['overrides']): HirePricing['overrides'] {
  if (!o || typeof o !== 'object') return {};
  const out: Record<string, Partial<HirePricingBase>> = {};
  for (const [companyId, v] of Object.entries(o).slice(0, 200)) {
    if (!v || typeof v !== 'object') continue;
    const entry: Partial<HirePricingBase> = {};
    for (const k of ['jobPrice', 'tier1Price', 'tier2Price', 'freeJobs', 'freeApplications'] as const) {
      const n = Number((v as Record<string, unknown>)[k]);
      if (Number.isFinite(n) && n >= 0) entry[k] = Math.round(n);
    }
    if (Object.keys(entry).length) out[companyId.slice(0, 60)] = entry;
  }
  return out;
}
