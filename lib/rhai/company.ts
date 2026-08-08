import 'server-only';
import { adminDb } from '@/lib/firebase/admin';

// ---------------------------------------------------------------------------
// Company settings — rhaiSettings/company.
// Rhea now bills through RHAI CONSULTING GROUP PRIVATE LIMITED (GST-registered
// company) instead of as a freelancer under TDS 194J. Statutory identifiers
// (GSTIN, CIN, registered office, company bank account) are one-time setup
// from the Accounting tab; invoice generation refuses to produce a tax
// invoice until GSTIN + bank details are on file.
// ---------------------------------------------------------------------------

export const COMPANY_SETTINGS_DOC = 'rhaiSettings/company';

export interface CompanyBank {
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  branch?: string;
  ifsc?: string;
}

export interface CompanySettings {
  legalName: string;
  gstin?: string;
  cin?: string;
  pan?: string;
  email?: string;
  registeredAddress?: string;
  /** GST state code, first two digits of the GSTIN. Karnataka = '29'. */
  stateCode?: string;
  bank?: CompanyBank;
  /** Invoice-number series prefix, e.g. RCG → RCG/25-26/007. */
  invoicePrefix?: string;
  /** Next sequence number in the series (per-FY reset is manual). */
  nextInvoiceNo?: number;
  /** Default SAC for services. 998313 = IT consulting & support. */
  sacCode?: string;
  gstRatePct?: number;
  /** Date of incorporation, YYYY-MM-DD — drives one-time compliance items. */
  incorporationDate?: string;
  updatedAt: number;
}

export const COMPANY_DEFAULTS: CompanySettings = {
  legalName: 'RHAI CONSULTING GROUP PRIVATE LIMITED',
  email: 'rhea@rosebazaar.in',
  stateCode: '29',
  invoicePrefix: 'RCG',
  nextInvoiceNo: 1,
  sacCode: '998313',
  gstRatePct: 18,
  updatedAt: 0
};

export async function loadCompanySettings(): Promise<CompanySettings> {
  const snap = await adminDb().doc(COMPANY_SETTINGS_DOC).get();
  const stored = (snap.data() as Partial<CompanySettings> | undefined) ?? {};
  return { ...COMPANY_DEFAULTS, ...stored };
}

export async function saveCompanySettings(patch: Partial<CompanySettings>): Promise<void> {
  await adminDb()
    .doc(COMPANY_SETTINGS_DOC)
    .set({ ...patch, updatedAt: Date.now() }, { merge: true });
}

/** Fields still missing before a compliant GST tax invoice can go out. */
export function companyGaps(c: CompanySettings): string[] {
  const gaps: string[] = [];
  if (!c.gstin?.trim()) gaps.push('GSTIN');
  if (!c.registeredAddress?.trim()) gaps.push('registered office address');
  if (!c.bank?.accountNumber?.trim() || !c.bank?.ifsc?.trim()) gaps.push('company bank account');
  return gaps;
}

/** Indian financial year label for a date, e.g. '25-26'. */
export function fyLabel(d = new Date()): string {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(y).slice(2)}-${String(y + 1).slice(2)}`;
}

/**
 * Claim the next invoice number in the series, atomically.
 * Format: {prefix}/{fy}/{NNN} — e.g. RCG/25-26/007.
 */
export async function nextInvoiceNumber(now = new Date()): Promise<string> {
  const ref = adminDb().doc(COMPANY_SETTINGS_DOC);
  const n = await adminDb().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const cur = ((snap.data() as Partial<CompanySettings> | undefined)?.nextInvoiceNo ??
      COMPANY_DEFAULTS.nextInvoiceNo) as number;
    tx.set(ref, { nextInvoiceNo: cur + 1, updatedAt: Date.now() }, { merge: true });
    return cur;
  });
  const prefix =
    (await loadCompanySettings()).invoicePrefix ?? COMPANY_DEFAULTS.invoicePrefix ?? 'RCG';
  return `${prefix}/${fyLabel(now)}/${String(n).padStart(3, '0')}`;
}
