// Statutory compliance calendar for an Indian private limited company
// (GST-registered, Karnataka, services). Client-safe: pure generators; the
// done/undone state lives in Firestore keyed by the generated item id, so
// regenerating the calendar never loses ticks.
//
// This is an operating checklist, not legal advice — dates follow the normal
// statutory schedule and skip extensions the govt announces ad hoc.

export type ComplianceCategory = 'gst' | 'income-tax' | 'tds' | 'roc' | 'state';

export interface ComplianceItem {
  /** Stable id: `${code}-${dueISO}` — the Firestore doc id for its state. */
  id: string;
  code: string;
  title: string;
  detail: string;
  category: ComplianceCategory;
  due: string; // YYYY-MM-DD
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/**
 * All items due inside an Indian financial year starting 1 Apr `fyStartYear`.
 * (Pass 2026 for FY 26-27.) Monthly items are emitted for the month they are
 * DUE (i.e. GSTR-3B due 20 May covers April's sales).
 */
export function complianceCalendar(fyStartYear: number, opts?: { incorporationDate?: string }): ComplianceItem[] {
  const items: ComplianceItem[] = [];
  const y0 = fyStartYear;
  const add = (code: string, due: string, title: string, detail: string, category: ComplianceCategory) =>
    items.push({ id: `${code}-${due}`, code, due, title, detail, category });

  // ---- Monthly (12 cycles: periods Apr..Mar, due the following month) ----
  for (let i = 0; i < 12; i++) {
    const periodMonth = 4 + i; // 4..15
    const py = periodMonth > 12 ? y0 + 1 : y0;
    const pm = periodMonth > 12 ? periodMonth - 12 : periodMonth;
    const dueMonth = pm === 12 ? 1 : pm + 1;
    const dy = pm === 12 ? py + 1 : py;
    const periodLabel = new Date(py, pm - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });

    add('gstr1', iso(dy, dueMonth, 11), `GSTR-1 — ${periodLabel}`, 'Outward supplies (sales) return for the month.', 'gst');
    add('gstr3b', iso(dy, dueMonth, 20), `GSTR-3B — ${periodLabel}`, 'Summary return + GST payment for the month.', 'gst');
    add('tds-deposit', iso(dy, dueMonth, 7), `TDS deposit — ${periodLabel}`, 'Deposit any TDS deducted on salaries / contractor / rent payments (skip if nothing deducted).', 'tds');
    add('pt-ka', iso(dy, dueMonth, 20), `Karnataka PT — ${periodLabel}`, 'Professional tax on salaries paid (only if employees on payroll).', 'state');
  }

  // ---- Quarterly TDS returns ----
  add('tds-q1', iso(y0, 7, 31), 'TDS return Q1 (26Q/24Q)', 'Apr–Jun quarter TDS return (skip if nothing deducted).', 'tds');
  add('tds-q2', iso(y0, 10, 31), 'TDS return Q2 (26Q/24Q)', 'Jul–Sep quarter TDS return.', 'tds');
  add('tds-q3', iso(y0 + 1, 1, 31), 'TDS return Q3 (26Q/24Q)', 'Oct–Dec quarter TDS return.', 'tds');
  add('tds-q4', iso(y0 + 1, 5, 31), 'TDS return Q4 (26Q/24Q)', 'Jan–Mar quarter TDS return.', 'tds');

  // ---- Advance tax ----
  add('advtax-1', iso(y0, 6, 15), 'Advance tax — 15%', 'First instalment of estimated FY income tax.', 'income-tax');
  add('advtax-2', iso(y0, 9, 15), 'Advance tax — 45%', 'Second instalment (cumulative 45%).', 'income-tax');
  add('advtax-3', iso(y0, 12, 15), 'Advance tax — 75%', 'Third instalment (cumulative 75%).', 'income-tax');
  add('advtax-4', iso(y0 + 1, 3, 15), 'Advance tax — 100%', 'Final instalment (full estimated tax).', 'income-tax');

  // ---- Annual: income tax + GST ----
  add('itr6', iso(y0, 10, 31), `ITR-6 — company income-tax return (FY ${y0 - 1}-${String(y0).slice(2)})`, 'For the previous financial year. Tax audit (if turnover crosses limits) is due 30 Sep.', 'income-tax');
  add('gstr9', iso(y0, 12, 31), `GSTR-9 — GST annual return (FY ${y0 - 1}-${String(y0).slice(2)})`, 'Annual GST return for the previous FY (optional below ₹2 Cr turnover, check each year).', 'gst');

  // ---- ROC / MCA (assumes AGM held 30 Sep, the usual outer date) ----
  add('dpt3', iso(y0, 6, 30), 'DPT-3 — return of deposits', 'Annual return of deposits / outstanding loan receipts. Nil filing still recommended.', 'roc');
  add('dir3kyc', iso(y0, 9, 30), 'DIR-3 KYC — director KYC', 'Every director with a DIN files KYC (web-based if details unchanged).', 'roc');
  add('agm', iso(y0, 9, 30), 'Hold AGM', 'Annual general meeting — outer date for a company with FY ending 31 Mar (first AGM: within 9 months of first FY end).', 'roc');
  add('adt1', iso(y0, 10, 14), 'ADT-1 — auditor appointment', 'Within 15 days of the AGM if the auditor was appointed/ratified.', 'roc');
  add('aoc4', iso(y0, 10, 29), 'AOC-4 — file financial statements', 'Within 30 days of the AGM.', 'roc');
  add('mgt7a', iso(y0, 11, 28), 'MGT-7A — annual return', 'Within 60 days of the AGM (MGT-7A for small companies / OPCs).', 'roc');
  add('msme1-h2', iso(y0, 4, 30), 'MSME-1 — half-year (Oct–Mar)', 'Outstanding dues to MSME suppliers >45 days. Nil? No filing needed.', 'roc');
  add('msme1-h1', iso(y0, 10, 31), 'MSME-1 — half-year (Apr–Sep)', 'Outstanding dues to MSME suppliers >45 days. Nil? No filing needed.', 'roc');

  // ---- One-time, incorporation-driven ----
  if (opts?.incorporationDate) {
    const inc = new Date(`${opts.incorporationDate}T00:00:00`);
    if (!Number.isNaN(inc.getTime())) {
      const d180 = new Date(inc.getTime() + 180 * 86_400_000);
      const dueIso = d180.toISOString().slice(0, 10);
      const fyStart = new Date(`${y0}-04-01T00:00:00`).getTime();
      const fyEnd = new Date(`${y0 + 1}-03-31T23:59:59`).getTime();
      if (d180.getTime() >= fyStart && d180.getTime() <= fyEnd) {
        add('inc20a', dueIso, 'INC-20A — commencement of business', 'One-time declaration within 180 days of incorporation. Needed before the company can start business / borrow.', 'roc');
      }
    }
  }

  return items.sort((a, b) => a.due.localeCompare(b.due));
}

export const COMPLIANCE_CATEGORY_META: Record<ComplianceCategory, { label: string; chip: string }> = {
  gst: { label: 'GST', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  'income-tax': { label: 'Income tax', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  tds: { label: 'TDS', chip: 'bg-sky-50 text-sky-700 border-sky-200' },
  roc: { label: 'ROC / MCA', chip: 'bg-amber-50 text-amber-800 border-amber-200' },
  state: { label: 'Karnataka', chip: 'bg-rose-50 text-rose-700 border-rose-200' }
};
