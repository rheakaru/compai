import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/rhai/server';
import {
  companyGaps,
  loadCompanySettings,
  saveCompanySettings,
  type CompanySettings
} from '@/lib/rhai/company';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const settings = await loadCompanySettings();
  return Response.json({ settings, gaps: companyGaps(settings) });
}

export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as Partial<CompanySettings>;
  // Whitelist — never let a client patch arbitrary keys into the doc.
  const patch: Partial<CompanySettings> = {};
  for (const k of [
    'legalName',
    'gstin',
    'cin',
    'pan',
    'email',
    'registeredAddress',
    'stateCode',
    'invoicePrefix',
    'sacCode',
    'incorporationDate'
  ] as const) {
    if (typeof body[k] === 'string') (patch as Record<string, unknown>)[k] = (body[k] as string).trim();
  }
  if (typeof body.gstRatePct === 'number') patch.gstRatePct = body.gstRatePct;
  if (typeof body.nextInvoiceNo === 'number' && body.nextInvoiceNo >= 1)
    patch.nextInvoiceNo = Math.round(body.nextInvoiceNo);
  if (body.bank && typeof body.bank === 'object') {
    patch.bank = Object.fromEntries(
      Object.entries(body.bank)
        .filter(([, v]) => typeof v === 'string')
        .map(([k, v]) => [k, (v as string).trim()])
    );
  }
  // GSTIN sanity: 15 chars, starts with 2-digit state code.
  if (patch.gstin && !/^\d{2}[A-Z0-9]{13}$/i.test(patch.gstin)) {
    return Response.json({ error: 'GSTIN should be 15 characters starting with a 2-digit state code' }, { status: 400 });
  }
  if (patch.gstin && !patch.stateCode) patch.stateCode = patch.gstin.slice(0, 2);

  await saveCompanySettings(patch);
  const settings = await loadCompanySettings();
  return Response.json({ settings, gaps: companyGaps(settings) });
}
