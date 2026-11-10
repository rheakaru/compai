import 'server-only';
import PDFDocument from 'pdfkit';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import {
  companyGaps,
  loadCompanySettings,
  nextInvoiceNumber,
  type CompanySettings
} from './company';
import { COL_INVOICES, syncLeadFromInvoice } from './invoice-server';
import {
  addDaysISO,
  computeGst,
  INVOICE_STAGE_LABEL,
  todayISO,
  type GstBreakup,
  type InvoiceEngagement,
  type InvoiceStage,
  type InvoiceLineItem,
  type RhaiInvoice
} from './invoices';

// ---------------------------------------------------------------------------
// GST tax-invoice generation for RHAI CONSULTING GROUP PRIVATE LIMITED.
// Single-page A4 in the house invoice style (mirrors the freelancer format
// Rhea used before, with the TDS-194J note replaced by GST lines).
// ---------------------------------------------------------------------------

export interface GenerateInvoiceInput {
  client: string; // billed-to legal name
  clientAddress?: string;
  clientGstin?: string;
  leadId?: string;
  lineItems: InvoiceLineItem[];
  /** Optional 'YYYY-MM-DD'; defaults today (IST). */
  issueDate?: string;
  sac?: string;
  gstRatePct?: number;
  notes?: string;
  /**
   * Part-payment invoicing: the full engagement value and which chunk this
   * invoice is. lineItems carry only the amount billed NOW. For a balance
   * invoice, previouslyInvoiced defaults to what earlier invoices to the same
   * client on the same engagement value already billed.
   */
  engagement?: { totalValue: number; stage: InvoiceStage; previouslyInvoiced?: number };
}

export interface GenerateInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  filename: string;
  storagePath: string;
  url: string; // 1h signed URL
  gst: GstBreakup;
  warnings: string[];
}

// pdfkit's built-in Helvetica has no ₹ glyph (U+20B9) — it renders as a
// stray "1". "Rs." is the standard fallback on Indian tax invoices.
const INR = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-IN')}`;

function invoiceFilename(client: string, iso: string): string {
  const c = client.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `Invoice_${c}_${iso}.pdf`;
}

/** "5 August 2026" from 'YYYY-MM-DD'. */
function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'long' })} ${d.getFullYear()}`;
}

interface BuildPdfParams {
  company: CompanySettings;
  invoiceNumber: string;
  issueDate: string;
  client: string;
  clientAddress?: string;
  clientGstin?: string;
  lineItems: InvoiceLineItem[];
  sac: string;
  gst: GstBreakup;
  engagement?: InvoiceEngagement;
}

export function buildInvoicePdf(p: BuildPdfParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 72, bottom: 72, left: 72, right: 72 } });
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const grey = '#888888';
    const ink = '#1a1a1a';
    const W = doc.page.width - 144; // content width

    // Header
    doc.font('Helvetica-Bold').fontSize(26).fillColor(ink).text('TAX INVOICE', 72, 72);
    doc.font('Helvetica').fontSize(10).fillColor(ink);
    const headRight = [
      `Invoice No: ${p.invoiceNumber}`,
      `Date: ${prettyDate(p.issueDate)}`,
      'Due: Within 7 days of receipt'
    ];
    doc.text(headRight.join('\n'), 72, 76, { width: W, align: 'right' });
    doc.moveDown(2);

    // FROM / BILLED TO
    const colW = W / 2 - 10;
    const blockTop = 150;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(grey).text('FROM', 72, blockTop);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(ink).text(p.company.legalName, 72, blockTop + 14, { width: colW });
    doc.font('Helvetica').fontSize(9.5).text(
      [
        p.company.registeredAddress,
        p.company.cin ? `CIN: ${p.company.cin}` : null,
        p.company.gstin ? `GSTIN: ${p.company.gstin}` : null,
        p.company.pan ? `PAN: ${p.company.pan}` : null,
        p.company.email
      ]
        .filter(Boolean)
        .join('\n'),
      72,
      doc.y + 2,
      { width: colW }
    );
    const fromBottom = doc.y;

    doc.font('Helvetica-Bold').fontSize(9).fillColor(grey).text('BILLED TO', 72 + W / 2 + 10, blockTop);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(ink).text(p.client, 72 + W / 2 + 10, blockTop + 14, { width: colW });
    doc.font('Helvetica').fontSize(9.5).text(
      [p.clientAddress, p.clientGstin ? `GSTIN: ${p.clientGstin}` : 'GSTIN: (unregistered)']
        .filter(Boolean)
        .join('\n'),
      72 + W / 2 + 10,
      doc.y + 2,
      { width: colW }
    );
    doc.y = Math.max(fromBottom, doc.y) + 24;

    // Items table
    const tableTop = doc.y;
    const cols = { desc: W - 200, sac: 70, amt: 130 };
    doc.rect(72, tableTop, W, 20).fill('#F0F0EE');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(grey);
    doc.text('DESCRIPTION', 78, tableTop + 6, { width: cols.desc - 12 });
    doc.text('SAC', 72 + cols.desc, tableTop + 6, { width: cols.sac, align: 'center' });
    doc.text('AMOUNT', 72 + cols.desc + cols.sac, tableTop + 6, { width: cols.amt - 6, align: 'right' });
    let y = tableTop + 20;

    doc.fillColor(ink);
    for (const item of p.lineItems) {
      const [title, ...rest] = item.description.split('\n');
      doc.font('Helvetica-Bold').fontSize(10);
      const titleH = doc.heightOfString(title, { width: cols.desc - 12 });
      doc.text(title, 78, y + 6, { width: cols.desc - 12 });
      let rowH = titleH + 12;
      if (rest.length) {
        doc.font('Helvetica').fontSize(9);
        const body = rest.join('\n');
        doc.text(body, 78, y + 6 + titleH + 2, { width: cols.desc - 12 });
        rowH += doc.heightOfString(body, { width: cols.desc - 12 }) + 2;
      }
      doc.font('Helvetica').fontSize(9.5);
      doc.text(p.sac, 72 + cols.desc, y + 6, { width: cols.sac, align: 'center' });
      doc.text(INR(item.amount), 72 + cols.desc + cols.sac, y + 6, { width: cols.amt - 6, align: 'right' });
      y += Math.max(rowH, 24);
      doc.moveTo(72, y).lineTo(72 + W, y).lineWidth(0.5).strokeColor('#DDDDDD').stroke();
    }

    // Tax rows
    const taxRows: Array<[string, string]> = [['Taxable value', INR(p.gst.taxable)]];
    if (p.gst.mode === 'cgst-sgst') {
      taxRows.push(
        [`CGST @ ${p.gst.ratePct / 2}%`, INR(p.gst.cgst)],
        [`SGST @ ${p.gst.ratePct / 2}%`, INR(p.gst.sgst)]
      );
    } else {
      taxRows.push([`IGST @ ${p.gst.ratePct}%`, INR(p.gst.igst)]);
    }
    taxRows.push(['Total Due (incl. GST)', INR(p.gst.total)]);

    y += 8;
    for (const [label, value] of taxRows) {
      const isTotal = label.startsWith('Total Due');
      doc
        .font(isTotal ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(isTotal ? 11 : 9.5)
        .fillColor(ink);
      doc.text(label, 72 + cols.desc - 140, y, { width: cols.sac + 140, align: 'right' });
      doc.text(value, 72 + cols.desc + cols.sac, y, { width: cols.amt - 6, align: 'right' });
      y += isTotal ? 20 : 15;
    }

    // Payment schedule — part-payment invoices only.
    if (p.engagement) {
      const e = p.engagement;
      const billedNow = p.gst.taxable;
      const remaining = Math.max(0, e.totalValue - e.previouslyInvoiced - billedNow);
      const pct = e.totalValue > 0 ? Math.round((billedNow / e.totalValue) * 100) : 0;
      y += 10;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(grey).text('PAYMENT SCHEDULE (EXCL. GST)', 72, y);
      y += 14;
      const rows: Array<[string, string, boolean]> = [['Total engagement value', INR(e.totalValue), false]];
      if (e.previouslyInvoiced > 0) rows.push(['Previously invoiced', INR(e.previouslyInvoiced), false]);
      rows.push([`This invoice — ${INVOICE_STAGE_LABEL[e.stage]} (${pct}%)`, INR(billedNow), true]);
      rows.push([remaining > 0 ? 'Balance to be invoiced' : 'Balance remaining', INR(remaining), false]);
      for (const [label, value, bold] of rows) {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(ink);
        doc.text(label, 72, y, { width: 260 });
        doc.text(value, 72 + 260, y, { width: 110, align: 'right' });
        y += 14;
      }
    }

    // Payment terms + bank
    y += 14;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(grey).text('PAYMENT TERMS', 72, y);
    doc.font('Helvetica').fontSize(9.5).fillColor(ink).text('Kindly clear within 7 days of receipt.', 72, y + 13);

    y += 40;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(grey).text('BANK DETAILS (NEFT / IMPS / RTGS)', 72, y);
    y += 13;
    const bank = p.company.bank ?? {};
    const bankRows: Array<[string, string | undefined]> = [
      ['Account Name', bank.accountName ?? p.company.legalName],
      ['Account Number', bank.accountNumber],
      ['Bank', bank.bankName],
      ['Branch', bank.branch],
      ['IFSC', bank.ifsc]
    ];
    for (const [label, value] of bankRows) {
      if (!value) continue;
      doc.font('Helvetica').fontSize(9).fillColor(grey).text(label, 72, y, { width: 110 });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ink).text(value, 182, y);
      y += 14;
    }

    // GST note + sign-off
    y += 10;
    doc
      .font('Helvetica-Oblique')
      .fontSize(8.5)
      .fillColor(grey)
      .text(
        'GST payable on reverse charge: No. This is a computer-generated tax invoice.',
        72,
        y,
        { width: W }
      );
    y += 28;
    doc.font('Helvetica').fontSize(10).fillColor(ink).text(`For ${p.company.legalName},`, 72, y);
    doc.text('Authorised Signatory', 72, y + 30);

    doc.end();
  });
}

export async function generateAndStoreInvoice(
  input: GenerateInvoiceInput
): Promise<GenerateInvoiceResult> {
  const company = await loadCompanySettings();
  const gaps = companyGaps(company);
  if (gaps.length) {
    throw new Error(
      `Company setup incomplete — fill in ${gaps.join(', ')} under Accounting → Company before generating GST invoices.`
    );
  }

  const client = input.client.trim();
  if (!client) throw new Error('client required');
  const lineItems = (input.lineItems ?? []).filter(li => li.description?.trim() && li.amount > 0);
  if (!lineItems.length) throw new Error('at least one line item with an amount is required');

  const issueDate = input.issueDate ?? todayISO(Date.now());
  const sac = input.sac ?? company.sacCode ?? '998313';
  const ratePct = input.gstRatePct ?? company.gstRatePct ?? 18;
  const taxable = lineItems.reduce((s, li) => s + li.amount, 0);
  const gst = computeGst(taxable, ratePct, input.clientGstin, company.stateCode ?? '29');
  const engagement = await resolveEngagement(input.engagement, client, taxable);

  const invoiceNumber = await nextInvoiceNumber();
  const filename = invoiceFilename(client, issueDate);
  const pdf = await buildInvoicePdf({
    company,
    invoiceNumber,
    issueDate,
    client,
    clientAddress: input.clientAddress?.trim() || undefined,
    clientGstin: input.clientGstin?.trim() || undefined,
    lineItems,
    sac,
    gst,
    engagement
  });

  const storagePath = `invoiceDocuments/${issueDate.slice(0, 4)}/${filename}`;
  const file = adminBucket().file(storagePath);
  await file.save(pdf, { contentType: 'application/pdf', resumable: false });
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 3600_000 });

  const warnings: string[] = [];
  if (!input.clientGstin?.trim())
    warnings.push('No client GSTIN — billed as unregistered (B2C). Add it if the client is registered.');
  if (!input.clientAddress?.trim()) warnings.push('No client address on the invoice.');

  const now = Date.now();
  const record: Omit<RhaiInvoice, 'id'> = {
    source: 'platform',
    invoiceNumber,
    client,
    ...(input.leadId ? { leadId: input.leadId } : {}),
    currency: 'INR',
    amount: gst.total,
    lineItems,
    issueDate,
    dueDate: addDaysISO(issueDate, 7),
    status: 'draft',
    ...(input.notes ? { notes: input.notes } : {}),
    gst,
    ...(input.clientGstin?.trim() ? { clientGstin: input.clientGstin.trim() } : {}),
    ...(input.clientAddress?.trim() ? { clientAddress: input.clientAddress.trim() } : {}),
    sac,
    ...(engagement ? { engagement } : {}),
    fileName: filename,
    storagePath,
    mime: 'application/pdf',
    createdAt: now,
    updatedAt: now
  };
  const ref = await adminDb().collection(COL_INVOICES).add(record);
  await syncLeadFromInvoice(input.leadId, 'draft');

  return { invoiceId: ref.id, invoiceNumber, filename, storagePath, url, gst, warnings };
}

/**
 * Validate a part-payment request. For a balance/milestone invoice with no
 * explicit previouslyInvoiced, sum the taxable value of earlier non-cancelled
 * invoices to the same client on the same engagement value.
 */
async function resolveEngagement(
  raw: GenerateInvoiceInput['engagement'],
  client: string,
  billedNow: number
): Promise<InvoiceEngagement | undefined> {
  if (!raw || !(Number(raw.totalValue) > 0)) return undefined;
  const totalValue = Math.round(Number(raw.totalValue));
  const stage: InvoiceStage = raw.stage in INVOICE_STAGE_LABEL ? raw.stage : 'advance';

  let previouslyInvoiced = Number(raw.previouslyInvoiced);
  if (!Number.isFinite(previouslyInvoiced) || previouslyInvoiced < 0) {
    previouslyInvoiced = 0;
    if (stage !== 'advance') {
      const snap = await adminDb()
        .collection(COL_INVOICES)
        .where('engagement.totalValue', '==', totalValue)
        .get();
      const key = client.trim().toLowerCase();
      for (const d of snap.docs) {
        const inv = d.data() as RhaiInvoice;
        if (inv.status === 'cancelled' || inv.client.trim().toLowerCase() !== key) continue;
        previouslyInvoiced += inv.gst?.taxable ?? 0;
      }
    }
  }
  if (previouslyInvoiced + billedNow > totalValue) {
    throw new Error(
      `This invoice (${INR(billedNow)}) plus what's already been invoiced (${INR(previouslyInvoiced)}) is more than the total engagement value (${INR(totalValue)}).`
    );
  }
  return { totalValue, stage, previouslyInvoiced };
}
