import 'server-only';

// One-click NDA generation — Rhea's standard mutual NDA (13 clauses, DPDP
// clause, consultant-protective IP clause, Bengaluru jurisdiction) rendered
// as a PDF with her scanned signature stamped on every page. The clause text
// below is ported VERBATIM from the canonical build_nda.py in her
// nda-agreements skill — do not paraphrase it.

import PDFDocument from 'pdfkit';
import type Anthropic from '@anthropic-ai/sdk';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import { anthropic, parseJsonLoose } from './server';
import { modelFor } from './models';
import { buildLeadContext } from './leadContext';

// ---------------------------------------------------------------------------
// Settings — rhaiSettings/nda: Rhea's address + the Storage path of her
// scanned signature PNG. Both are one-time setup from the NDA card.
// ---------------------------------------------------------------------------

export const NDA_SETTINGS_DOC = 'rhaiSettings/nda';
export const SIGNATURE_STORAGE_PATH = 'rhaiPrivate/signature.png';

export interface NdaSettings {
  address?: string;
  signaturePath?: string;
  updatedAt: number;
}

export async function loadNdaSettings(): Promise<NdaSettings> {
  const snap = await adminDb().doc(NDA_SETTINGS_DOC).get();
  return (snap.data() as NdaSettings | undefined) ?? { updatedAt: 0 };
}

export async function saveNdaSettings(patch: Partial<NdaSettings>): Promise<void> {
  await adminDb()
    .doc(NDA_SETTINGS_DOC)
    .set({ ...patch, updatedAt: Date.now() }, { merge: true });
}

/** Rhea's signature PNG from Storage, or null if not uploaded yet. */
export async function loadSignaturePng(settings?: NdaSettings): Promise<Buffer | null> {
  const s = settings ?? (await loadNdaSettings());
  if (!s.signaturePath) return null;
  try {
    const [buf] = await adminBucket().file(s.signaturePath).download();
    return buf;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Static details (never change) + formatting helpers
// ---------------------------------------------------------------------------

export const CONSULTANT = {
  name: 'Ms. Rhea Karuturi',
  printedName: 'Rhea Karuturi',
  title: 'Freelance Consultant',
  pan: 'DXFPK0614B',
  email: 'rhea@rosebazaar.in'
} as const;

export const BLANK = '____________________';

/** "24 July 2026" — no leading zero, full month. */
export function formatEffectiveDate(d = new Date()): string {
  return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'long' })} ${d.getFullYear()}`;
}

/** NDA_{Client_Name_With_Underscores}_Rhea_Karuturi_{YYYY-MM-DD}.pdf */
export function ndaFilename(clientLegalName: string, d = new Date()): string {
  const client = clientLegalName
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
  return `NDA_${client}_Rhea_Karuturi_${iso}.pdf`;
}

// ---------------------------------------------------------------------------
// Clause text — VERBATIM port of clauses() in build_nda.py. Inline <b>…</b>
// markup is preserved and rendered as bold runs; &quot; becomes ".
// ---------------------------------------------------------------------------

const FOOTNOTE =
  'This document is a template prepared for the Parties’ convenience. It is not legal ' +
  'advice, and neither Party has relied on the other in preparing it. Each Party should ' +
  'have it reviewed by a qualified legal adviser before signing.';

/** The consultant-side tail always appended to the itemisation. */
const CONSULTANT_ITEMS_TAIL =
  'and, in the case of the Consultant, her methodologies, frameworks, ' +
  'prompts, models, analyses, templates, source code, tooling and proposals';

interface ClauseConfig {
  purpose: string;
  confidentialItems: string;
  termYears: string;
  survivalYears: string;
  jurisdiction: string;
  includeDpdpClause: boolean;
}

function clauses(c: ClauseConfig): [string, string[]][] {
  const out: [string, string[]][] = [
    [
      'Purpose',
      [
        `The Parties wish to exchange information in connection with ${c.purpose} ` +
          '(the <b>&quot;Purpose&quot;</b>). Each Party may disclose Confidential ' +
          'Information to the other for the Purpose.'
      ]
    ],
    [
      'Confidential Information',
      [
        '<b>&quot;Confidential Information&quot;</b> means any information disclosed by or ' +
          'on behalf of the Disclosing Party to the Receiving Party, whether before or after ' +
          'the Effective Date, in any form (written, oral, electronic, visual or otherwise) ' +
          'and whether or not marked as confidential, which by its nature or the ' +
          'circumstances of its disclosure ought reasonably to be regarded as confidential.',
        `Without limiting the foregoing, Confidential Information includes: ${c.confidentialItems}.`
      ]
    ],
    [
      'Exclusions',
      [
        'Confidential Information does not include information which the Receiving Party ' +
          'can demonstrate by written record: (a) is or becomes publicly available other than ' +
          'through breach of this Agreement; (b) was lawfully in the Receiving Party’s ' +
          'possession, free of any duty of confidence, before disclosure by the Disclosing ' +
          'Party; (c) is lawfully received from a third party who is free to disclose it; or ' +
          '(d) is independently developed by the Receiving Party without use of or reference ' +
          'to the Disclosing Party’s Confidential Information.'
      ]
    ],
    [
      'Obligations of the Receiving Party',
      [
        'The Receiving Party shall: (a) keep the Confidential Information strictly ' +
          'confidential and use it solely for the Purpose; (b) protect it using no less than ' +
          'a reasonable degree of care, and in any event no less care than it applies to its ' +
          'own confidential information of similar importance; (c) not disclose it to any ' +
          'third party except as permitted by the following clause; and (d) not use it to ' +
          'obtain any commercial advantage over, or otherwise to the detriment of, the ' +
          'Disclosing Party.'
      ]
    ],
    [
      'Permitted Disclosures',
      [
        'The Receiving Party may disclose Confidential Information: (a) to its employees, ' +
          'officers, sub-contractors and professional advisers who need to know it for the ' +
          'Purpose, provided that the Receiving Party procures that each such person is bound ' +
          'by confidentiality obligations no less protective than those in this Agreement and ' +
          'remains liable for their acts and omissions; and (b) to the extent required by law, ' +
          'any court of competent jurisdiction, or any regulatory or governmental authority, ' +
          'provided that (where lawful and practicable) the Receiving Party gives the ' +
          'Disclosing Party prior written notice and reasonable assistance to seek protective ' +
          'relief.'
      ]
    ]
  ];

  if (c.includeDpdpClause) {
    out.push([
      'Personal Data and Data Protection',
      [
        'The Parties acknowledge that Confidential Information disclosed for the Purpose may ' +
          'contain personal data relating to the Company’s employees, workers, suppliers, ' +
          'vendors and other individuals, including where the Consultant is given access to or ' +
          'asked to observe the Company’s internal messaging groups or systems.',
        'Where the Consultant processes such personal data, she shall do so solely on the ' +
          'Company’s documented instructions and solely for the Purpose; shall not use it for ' +
          'any other purpose; shall apply reasonable technical and organisational security ' +
          'safeguards; shall not retain it for longer than is necessary for the Purpose; and ' +
          'shall promptly notify the Company of any personal data breach of which she becomes ' +
          'aware. The Company confirms that, as the data fiduciary, it is and shall remain ' +
          'responsible for establishing a lawful basis for such processing, including obtaining ' +
          'any notice, consent or other authorisation required under the Digital Personal Data ' +
          'Protection Act, 2023 and the rules made thereunder, and for informing the relevant ' +
          'individuals of the Consultant’s access. Nothing in this Agreement obliges the ' +
          'Consultant to access any personal data unless the Company has confirmed such lawful ' +
          'basis is in place. The Parties shall, if required, enter into further ' +
          'data-processing terms.'
      ]
    ]);
  }

  out.push(
    [
      'No Licence; Pre-Existing and Background Intellectual Property',
      [
        'All Confidential Information remains the property of the Disclosing Party. Nothing in ' +
          'this Agreement transfers or grants any right, title, interest, licence or intellectual ' +
          'property right in or to any Confidential Information, save the limited right to use it ' +
          'for the Purpose. For the avoidance of doubt, the Consultant retains all right, title ' +
          'and interest in her pre-existing and independently developed methodologies, frameworks, ' +
          'know-how, templates, prompts, models, tooling and source code, and nothing in this ' +
          'Agreement restricts the Consultant from providing services to other clients, including ' +
          'in the same or a similar industry, provided she does not use or disclose the Company’s ' +
          'Confidential Information in doing so. Ownership of any deliverables created for the ' +
          'Company shall be dealt with in a separate written services agreement.'
      ]
    ],
    [
      'Return or Destruction',
      [
        'On the written request of the Disclosing Party at any time, and in any event on expiry ' +
          'or termination of the Purpose, the Receiving Party shall promptly return or securely ' +
          'destroy all Confidential Information in its possession or control and, if requested, ' +
          'certify such destruction in writing. The Receiving Party may retain one copy to the ' +
          'extent required by law or its bona fide internal record-retention or ' +
          'professional-compliance policies, or where held in routine backup archives, provided ' +
          'that such retained copies remain subject to this Agreement for so long as they are ' +
          'retained.'
      ]
    ],
    [
      'Term and Survival',
      [
        `This Agreement commences on the Effective Date and continues for ${c.termYears} ` +
          'years, unless earlier terminated by either Party on thirty (30) days’ written notice. ' +
          'The confidentiality obligations in this Agreement survive expiry or termination and ' +
          `continue for a period of ${c.survivalYears} years from the date of expiry or ` +
          'termination, and indefinitely in respect of any Confidential Information that ' +
          'constitutes a trade secret for so long as it remains a trade secret under applicable ' +
          'law.'
      ]
    ],
    [
      'No Obligation; No Warranty',
      [
        'Nothing in this Agreement obliges either Party to disclose any Confidential ' +
          'Information, to proceed with the Purpose, or to enter into any further agreement or ' +
          'transaction. Confidential Information is provided &quot;as is&quot;, and no Party ' +
          'makes any representation or warranty as to its accuracy or completeness, save that ' +
          'each Party warrants that it is entitled to disclose the Confidential Information it ' +
          'discloses.'
      ]
    ],
    [
      'Remedies',
      [
        'The Parties acknowledge that damages alone may not be an adequate remedy for a breach ' +
          'of this Agreement, and that the Disclosing Party shall be entitled to seek injunctive ' +
          'relief, specific performance and other equitable remedies, without the requirement to ' +
          'post security, in addition to any other remedies available at law.'
      ]
    ],
    [
      'General',
      [
        '(a) <b>Entire agreement.</b> This Agreement is the entire agreement between the Parties ' +
          'as to its subject matter and supersedes all prior discussions and understandings ' +
          'relating to it. (b) <b>Variation.</b> No variation is effective unless in writing and ' +
          'signed by both Parties. (c) <b>No waiver.</b> No failure or delay in exercising a right ' +
          'is a waiver of it. (d) <b>Severability.</b> If any provision is held invalid or ' +
          'unenforceable, the remainder continues in full force. (e) <b>Assignment.</b> Neither ' +
          'Party may assign this Agreement without the other’s prior written consent. ' +
          '(f) <b>No partnership.</b> Nothing in this Agreement creates a partnership, joint ' +
          'venture, agency or employment relationship between the Parties. ' +
          '(g) <b>Counterparts and execution.</b> This Agreement may be executed in counterparts ' +
          'and by electronic signature or exchange of scanned copies, each of which is deemed an ' +
          'original and together constitute one agreement.'
      ]
    ],
    [
      'Governing Law and Jurisdiction',
      [
        'This Agreement and any dispute or claim arising out of or in connection with it ' +
          '(including non-contractual disputes or claims) are governed by and construed in ' +
          `accordance with the laws of India. The courts at ${c.jurisdiction} shall have ` +
          'exclusive jurisdiction.'
      ]
    ]
  );
  return out;
}

// ---------------------------------------------------------------------------
// Mini rich-text renderer — handles the <b>…</b> runs and &quot; entities in
// the verbatim clause text, with justified body text.
// ---------------------------------------------------------------------------

interface Run {
  text: string;
  bold: boolean;
}

function parseRuns(markup: string): Run[] {
  const runs: Run[] = [];
  const re = /<b>([\s\S]*?)<\/b>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const decode = (s: string) => s.replace(/&quot;/g, '“').replace(/<br\s*\/?>/g, '\n');
  while ((m = re.exec(markup)) !== null) {
    if (m.index > last) runs.push({ text: decode(markup.slice(last, m.index)), bold: false });
    runs.push({ text: decode(m[1]), bold: true });
    last = re.lastIndex;
  }
  if (last < markup.length) runs.push({ text: decode(markup.slice(last)), bold: false });
  // pdfkit drops leading spaces on continued runs — shift them to the tail of
  // the previous run so "…</b> This" keeps its space.
  for (let i = 1; i < runs.length; i++) {
    const m2 = /^\s+/.exec(runs[i].text);
    if (m2) {
      runs[i - 1].text += ' ';
      runs[i].text = runs[i].text.slice(m2[0].length);
    }
  }
  // Straight quotes read better in pairs — alternate open/close.
  let open = true;
  for (const r of runs) {
    r.text = r.text.replace(/“/g, () => {
      const q = open ? '“' : '”';
      open = !open;
      return q;
    });
  }
  return runs.filter(r => r.text.length > 0);
}

// ---------------------------------------------------------------------------
// buildNdaPdf — the pdfkit port of build_nda.py
// ---------------------------------------------------------------------------

export interface BuildNdaParams {
  clientLegalName: string;
  /** Registered office. Pass the marked blank if unknown — never invent. */
  clientAddress?: string | null;
  clientCIN?: string | null;
  /** Optional site/facility address (in-person recce engagements). */
  clientSite?: string | null;
  /** Engagement-specific purpose text — names the work and the business. */
  purpose: string;
  /** Itemised list of what will actually be shared, from discovery. */
  confidentialInfoItems: string[];
  /** "24 July 2026" format. */
  effectiveDate: string;
  oneWay?: boolean;
  termYears?: string;
  survivalYears?: string;
  jurisdiction?: string;
  includeDpdpClause?: boolean;
  /** Rhea's address from settings; marked blank if not set. */
  consultantAddress?: string | null;
  /** Rhea's scanned signature — stamped as initials per page + in the block. */
  signaturePng?: Buffer | null;
}

const IN = 72; // 1 inch in points
const BODY = 9.5;
const BODY_GAP = 4; // leading 13.5
const GREY = '#555555';
const LIGHT_GREY = '#666666';

export function buildNdaPdf(params: BuildNdaParams): Promise<Buffer> {
  const {
    clientLegalName,
    clientAddress,
    clientCIN,
    clientSite,
    purpose,
    confidentialInfoItems,
    effectiveDate,
    oneWay = false,
    termYears = 'three (3)',
    survivalYears = 'three (3)',
    jurisdiction = 'Bengaluru, Karnataka',
    includeDpdpClause = true,
    consultantAddress,
    signaturePng = null
  } = params;

  const items = confidentialInfoItems.map(i => i.replace(/[.;]\s*$/, ''));
  const confidentialItems = [...items, CONSULTANT_ITEMS_TAIL].join('; ');

  const consultantAddr =
    consultantAddress?.trim() || `${BLANK}____________, Bengaluru, Karnataka, India`;
  const clientAddr = clientAddress?.trim() || BLANK;
  const cin = clientCIN?.trim() || BLANK;

  const doc = new PDFDocument({
    size: 'A4',
    margins: { left: IN, right: IN, top: 0.9 * IN, bottom: 0.9 * IN },
    bufferPages: true,
    info: {
      Title: oneWay ? 'Non-Disclosure Agreement' : 'Mutual Non-Disclosure Agreement',
      Author: 'Rhea Karuturi'
    }
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const contentWidth = doc.page.width - 2 * IN;

  const body = (markup: string, opts: { width?: number; indent?: number } = {}) => {
    const runs = parseRuns(markup);
    doc.fontSize(BODY).fillColor('black');
    for (let i = 0; i < runs.length; i++) {
      doc.font(runs[i].bold ? 'Helvetica-Bold' : 'Helvetica').text(runs[i].text, {
        width: opts.width ?? contentWidth,
        align: 'justify',
        lineGap: BODY_GAP,
        continued: i < runs.length - 1
      });
    }
    doc.moveDown(0.55);
  };

  // --- Title block ---------------------------------------------------------
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(oneWay ? 'NON-DISCLOSURE AGREEMENT' : 'MUTUAL NON-DISCLOSURE AGREEMENT', {
      width: contentWidth,
      align: 'center'
    });
  doc.moveDown(0.2);
  doc
    .font('Helvetica')
    .fontSize(BODY)
    .fillColor(GREY)
    .text(`Executed on ${effectiveDate} (the “Effective Date”)`, {
      width: contentWidth,
      align: 'center'
    });
  doc.moveDown(1);
  doc.fillColor('black');

  body(
    `This ${oneWay ? '' : 'Mutual '}Non-Disclosure Agreement (this <b>&quot;Agreement&quot;</b>) is ` +
      'entered into on the Effective Date by and between:'
  );

  // --- Parties (numbered hanging-indent rows, like the borderless table) ---
  const party = (num: string, markup: string) => {
    const numWidth = 0.32 * IN;
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(BODY).text(num, IN, y, { width: numWidth });
    doc.y = y;
    const runs = parseRuns(markup);
    for (let i = 0; i < runs.length; i++) {
      doc
        .font(runs[i].bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(BODY)
        .text(runs[i].text, IN + numWidth, doc.y, {
          width: contentWidth - numWidth,
          align: 'justify',
          lineGap: BODY_GAP,
          continued: i < runs.length - 1
        });
    }
    doc.x = IN;
    doc.moveDown(0.55);
  };

  party(
    '(1)',
    `<b>${CONSULTANT.name}</b>, an individual carrying on business as a ` +
      `freelance consultant, PAN ${CONSULTANT.pan}, having her principal place ` +
      `of business at ${consultantAddr} (<b>&quot;Consultant&quot;</b>); and`
  );

  let clientBlock =
    `<b>${clientLegalName}</b>, a company incorporated under the Companies Act, having its ` +
    `registered office at ${clientAddr}`;
  if (clientSite?.trim()) clientBlock += `, and its facility at ${clientSite.trim()}`;
  clientBlock += ` (CIN: ${cin}) (<b>&quot;Company&quot;</b>).`;
  party('(2)', clientBlock);

  body(
    oneWay
      ? 'The Consultant and the Company are each referred to as a <b>&quot;Party&quot;</b> and ' +
          'together as the <b>&quot;Parties&quot;</b>. The Company is the ' +
          '<b>&quot;Disclosing Party&quot;</b> and the Consultant is the ' +
          '<b>&quot;Receiving Party&quot;</b>.'
      : 'The Consultant and the Company are each referred to as a <b>&quot;Party&quot;</b> and ' +
          'together as the <b>&quot;Parties&quot;</b>. In relation to any particular item of ' +
          'Confidential Information, the Party disclosing it is the ' +
          '<b>&quot;Disclosing Party&quot;</b> and the Party receiving it is the ' +
          '<b>&quot;Receiving Party&quot;</b>.'
  );

  // --- Clauses -------------------------------------------------------------
  const all = clauses({
    purpose,
    confidentialItems,
    termYears,
    survivalYears,
    jurisdiction,
    includeDpdpClause
  });
  all.forEach(([heading, paras], idx) => {
    // Keep the heading with at least the first line of its body.
    if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
    doc.moveDown(0.15);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('black')
      .text(`${idx + 1}. ${heading}`, { width: contentWidth });
    doc.moveDown(0.25);
    for (const p of paras) body(p);
  });

  // --- Signature block (kept together) -------------------------------------
  const sigBlockHeight = 300; // AGREED line + block + footnote, kept together
  if (doc.y > doc.page.height - doc.page.margins.bottom - sigBlockHeight) doc.addPage();

  doc.moveDown(0.6);
  body('<b>AGREED</b> by the Parties as of the Effective Date.');
  doc.moveDown(0.8);

  const colGap = 24;
  const colWidth = (contentWidth - colGap) / 2;
  const leftX = IN;
  const rightX = IN + colWidth + colGap;
  const topY = doc.y;
  const sigLine = '______________________';

  const sigText = (x: number, y: number, text: string, bold = false) => {
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(9)
      .fillColor('black')
      .text(text, x, y, { width: colWidth, lineGap: 4 });
  };

  sigText(leftX, topY, 'For and on behalf of', true);
  sigText(leftX, doc.y, CONSULTANT.printedName.toUpperCase(), true);
  sigText(rightX, topY, 'For and on behalf of', true);
  sigText(rightX, doc.y, clientLegalName.toUpperCase(), true);

  // Signature area — full-size signature in Rhea's column, client blank.
  const sigAreaY = topY + 34;
  const sigAreaH = 64;
  if (signaturePng) {
    try {
      doc.image(signaturePng, leftX + 4, sigAreaY + 2, {
        fit: [180, sigAreaH - 6]
      });
    } catch {
      // Bad image data — leave the line blank rather than fail the document.
    }
  }
  const linesY = sigAreaY + sigAreaH;
  sigText(leftX, linesY, `Signature: ${sigLine}`);
  sigText(rightX, linesY, `Signature: ${sigLine}`);
  sigText(leftX, linesY + 17, `Name: ${CONSULTANT.printedName}`);
  sigText(rightX, linesY + 17, `Name: ${sigLine}`);
  sigText(leftX, linesY + 34, `Title: ${CONSULTANT.title}`);
  sigText(rightX, linesY + 34, `Title: ${sigLine}`);
  sigText(leftX, linesY + 51, `Date: ${signaturePng ? effectiveDate : sigLine}`);
  sigText(rightX, linesY + 51, `Date: ${sigLine}`);

  // --- Not-legal-advice footnote (verbatim, small italic grey) -------------
  doc.x = IN;
  doc.y = linesY + 51 + 30;
  doc
    .font('Helvetica-Oblique')
    .fontSize(8)
    .fillColor(LIGHT_GREY)
    .text(FOOTNOTE, IN, doc.y, { width: contentWidth, lineGap: 3 });

  // --- Initials: signature stamped small on EVERY page ---------------------
  if (signaturePng) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const page = doc.page;
      const w = 90;
      const h = 30;
      const x = page.width - page.margins.right - w;
      const y = page.height - page.margins.bottom + 8;
      // Writing inside the bottom margin would trigger pdfkit's auto page
      // break and spawn blank pages — lift the margin while stamping.
      const savedBottom = page.margins.bottom;
      page.margins.bottom = 0;
      try {
        doc.image(signaturePng, x, y, { fit: [w, h] });
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor(LIGHT_GREY)
          .text(effectiveDate, x, y + h + 2, { width: w, align: 'right', lineBreak: false });
      } catch {
        // Bad image data — skip initials rather than fail the document.
      } finally {
        page.margins.bottom = savedBottom;
      }
    }
  }

  doc.end();
  return done;
}

// ---------------------------------------------------------------------------
// draftNdaFields — the one model call that makes this one-click. Given the
// client's legal name (and the lead's discovery context when available),
// drafts the engagement-specific Purpose and the Confidential Information
// itemisation, and extracts — never guesses — the registered address and CIN.
// ---------------------------------------------------------------------------

export interface NdaDraftFields {
  purpose: string;
  confidentialInfoItems: string[];
  clientAddress: string | null;
  clientCIN: string | null;
  /** Where a web-looked-up address/CIN came from — so Rhea can verify it. */
  sourceNote?: string | null;
}

const DEFAULT_PURPOSE = (client: string) =>
  'the evaluation, scoping and possible delivery by the Consultant of advisory, ' +
  'workshop, data-analysis and software services to the Company, including without ' +
  'limitation the design and development of AI tooling and an operational intelligence ' +
  `dashboard for the business of ${client}`;

const DEFAULT_ITEMS = [
  'business, financial and management information; profit and loss data, margins, cost structures and pricing',
  'purchase registers, supplier and vendor lists, procurement rates and rebate arrangements',
  'production, quality and inventory records',
  'enterprise resource planning and business intelligence system data and exports',
  'internal communications, including messages and content within the Company’s messaging groups and channels',
  'project reports and investment memoranda'
];

export async function draftNdaFields(
  clientLegalName: string,
  leadId?: string
): Promise<NdaDraftFields> {
  let leadContext = '';
  if (leadId) {
    const built = await buildLeadContext(leadId).catch(() => null);
    if (built) leadContext = built.context;
  }

  const system = `You draft two fields of a consultant's standard mutual NDA, plus find two facts about the client company. The consultant is Rhea Karuturi, a freelance AI consultant (workshops, data analysis, operational intelligence dashboards, software).

You have a web_search tool. If the client's REGISTERED OFFICE address and CIN are not already in the discovery context, SEARCH for them — Indian company registration is public. Query the company's exact legal name against sources like the MCA master-data portal, Tofler, Zauba Corp, IndiaFilings, or thecompanycheck. Prefer the registered office (not a plant or branch). An Indian CIN is a 21-character code (e.g. L24232GJ2008PLC054columns-style: one letter, 5 digits, 2-letter state code, 4-digit year, 3 letters, 6 digits).

Rules: a value confirmed from an authoritative public source is GOOD — use it. NEVER fabricate or approximate: if search does not yield a confident, specific value, return null for that field. Do not return a partial/guessed CIN. Verify the name matches the company you searched (beware same-name companies in different states).

Reply with ONLY a JSON object (after any searching):
{
  "purpose": string,       // the Purpose clause body — MUST name the actual engagement AND the client's actual business. Pattern: "the evaluation, scoping and possible delivery by the Consultant of advisory, workshop, data-analysis and software services to the Company, including without limitation [the specific work discussed] for the Company's [actual business]". Never generic ("business discussions" is unacceptable). Lowercase start, no trailing period.
  "confidentialInfoItems": string[],  // 5-9 items itemising what THIS client will actually share, drawn from the discovery context (name their key systems, customers, data). Each item lowercase, no trailing punctuation. Do NOT include the consultant's own materials — that is appended automatically.
  "clientAddress": string | null,  // the client's REGISTERED OFFICE address from context or web search; null if not confidently found.
  "clientCIN": string | null,      // the client's 21-char CIN from context or web search; null if not confidently found.
  "sourceNote": string | null      // one short line naming where the address/CIN came from (e.g. "CIN + registered office via Tofler"), or null
}`;

  const user = leadContext
    ? `Client legal name: ${clientLegalName}\n\nDISCOVERY CONTEXT (source of truth for what they'll share and what the engagement is):\n${leadContext.slice(0, 24_000)}\n\nIf the registered office / CIN are not in this context, search the web for them.`
    : `Client legal name: ${clientLegalName}\n\nNo discovery context is on file. Search the web for this company's registered office address and CIN. Infer the industry from the name/search results for the Purpose; otherwise keep the purpose to the standard advisory/workshop/dashboard scope and the itemisation to typical operations/finance categories.`;

  try {
    const msg = await anthropic().messages.create({
      model: modelFor('suggest'),
      max_tokens: 1500,
      system,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 } as unknown as Anthropic.Messages.Tool],
      messages: [{ role: 'user', content: user }]
    });
    const text = msg.content
      .filter((b): b is { type: 'text'; text: string } & typeof b => b.type === 'text')
      .map(b => b.text)
      .join('\n');
    const parsed = parseJsonLoose<Partial<NdaDraftFields> & { sourceNote?: string }>(text);
    // Only accept a CIN that actually looks like one (21 chars: letter, 5
    // digits, 2-letter state, 4-digit year, 3 letters, 6 digits) — never let a
    // malformed/hallucinated code through onto a legal document.
    const rawCin = parsed.clientCIN?.trim().toUpperCase().replace(/\s+/g, '');
    const validCin = rawCin && /^[LUu]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/i.test(rawCin) ? rawCin : null;
    return {
      purpose: parsed.purpose?.trim() || DEFAULT_PURPOSE(clientLegalName),
      confidentialInfoItems:
        Array.isArray(parsed.confidentialInfoItems) && parsed.confidentialInfoItems.length > 0
          ? parsed.confidentialInfoItems.map(String)
          : DEFAULT_ITEMS,
      clientAddress: parsed.clientAddress?.trim() || null,
      clientCIN: validCin,
      sourceNote: parsed.sourceNote?.trim() || null
    };
  } catch {
    return {
      purpose: DEFAULT_PURPOSE(clientLegalName),
      confidentialInfoItems: DEFAULT_ITEMS,
      clientAddress: null,
      clientCIN: null
    };
  }
}

// ---------------------------------------------------------------------------
// Full one-click orchestration — draft missing fields, render + sign, store,
// record in rhaiNdas, register on the lead. Shared by the dashboard route
// (app/api/rhai/nda) and Rhai's WhatsApp generate_nda tool.
// ---------------------------------------------------------------------------

export interface GenerateNdaInput {
  clientLegalName: string;
  leadId?: string;
  address?: string;
  cin?: string;
  purpose?: string;
}

export interface GenerateNdaResult {
  url: string; // signed download URL, 1h
  filename: string;
  storagePath: string;
  blanks: string[];
  signed: boolean;
  /** If the address/CIN were looked up online — where from, so Rhea verifies. */
  sourceNote?: string | null;
  /** Which fields were auto-filled from a web lookup (vs. discovery/manual). */
  lookedUp?: string[];
}

export async function generateAndStoreNda(input: GenerateNdaInput): Promise<GenerateNdaResult> {
  const clientLegalName = input.clientLegalName.trim();
  const leadId = input.leadId?.trim() || undefined;

  const settings = await loadNdaSettings();
  const [drafted, signaturePng] = await Promise.all([
    draftNdaFields(clientLegalName, leadId),
    loadSignaturePng(settings)
  ]);

  const clientAddress = input.address?.trim() || drafted.clientAddress;
  const clientCIN = input.cin?.trim() || drafted.clientCIN;
  const purpose = input.purpose?.trim() || drafted.purpose;
  // Track fields that came from the web lookup (not manual input / discovery)
  // so the UI can flag them "verify before sending".
  const lookedUp: string[] = [];
  if (!input.address?.trim() && drafted.clientAddress) lookedUp.push('registered office');
  if (!input.cin?.trim() && drafted.clientCIN) lookedUp.push('CIN');
  const now = new Date();
  const effectiveDate = formatEffectiveDate(now);

  const pdf = await buildNdaPdf({
    clientLegalName,
    clientAddress,
    clientCIN,
    purpose,
    confidentialInfoItems: drafted.confidentialInfoItems,
    effectiveDate,
    consultantAddress: settings.address ?? null,
    signaturePng
  });

  // Everything left as a marked blank — Rhea must fill these before sending.
  const blanks: string[] = [];
  if (!settings.address?.trim()) blanks.push('Rhea’s address (set it in NDA settings)');
  if (!clientAddress) blanks.push('Client registered office address');
  if (!clientCIN) blanks.push('Client CIN');

  const filename = ndaFilename(clientLegalName, now);
  const storagePath = `ndaDocuments/${now.getFullYear()}/${filename}`;
  const file = adminBucket().file(storagePath);
  await file.save(pdf, { contentType: 'application/pdf', resumable: false });
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000
  });

  const createdAt = Date.now();
  await adminDb().collection('rhaiNdas').add({
    clientLegalName,
    filename,
    storagePath,
    ...(leadId ? { leadId } : {}),
    blanks,
    signed: !!signaturePng,
    createdAt
  });

  if (leadId) {
    const leadRef = adminDb().collection('workshopLeads').doc(leadId);
    if ((await leadRef.get()).exists) {
      const summary = [
        `# ${filename}`,
        '',
        `Mutual NDA generated for ${clientLegalName}, effective ${effectiveDate}.`,
        '',
        `**Purpose:** ${purpose}`,
        '',
        '**Confidential Information itemisation:**',
        ...drafted.confidentialInfoItems.map(i => `- ${i}`),
        '',
        `Client registered office: ${clientAddress ?? BLANK}`,
        `Client CIN: ${clientCIN ?? BLANK}`,
        lookedUp.length
          ? `Auto-filled from web lookup (VERIFY): ${lookedUp.join(', ')}${drafted.sourceNote ? ` — ${drafted.sourceNote}` : ''}`
          : null,
        signaturePng
          ? 'Signed with Rhea’s scanned signature (initials on every page + signature block).'
          : 'Generated WITHOUT signature — none on file.',
        blanks.length ? `Blanks to fill before sending: ${blanks.join('; ')}` : 'No blanks.'
      ]
        .filter(Boolean)
        .join('\n');
      await leadRef.collection('documents').doc().set({
        name: filename,
        origin: 'generated',
        kind: 'nda',
        text: summary,
        storagePath,
        mime: 'application/pdf',
        sizeBytes: pdf.length,
        createdAt,
        updatedAt: createdAt
      });
    }
  }

  return {
    url,
    filename,
    storagePath,
    blanks,
    signed: !!signaturePng,
    ...(lookedUp.length ? { lookedUp } : {}),
    ...(drafted.sourceNote ? { sourceNote: drafted.sourceNote } : {})
  };
}
