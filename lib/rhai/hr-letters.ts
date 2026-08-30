import 'server-only';
import PDFDocument from 'pdfkit';
import { loadCompanySettings, type CompanySettings } from './company';
import { loadInternConfig } from './intern-config';
import { loadSignaturePng } from './nda';
import { type InternConfig } from './onboarding';

// Offer + joining letters for a new hire, under RHAI CONSULTING GROUP PRIVATE
// LIMITED, on the same letterhead as the invoices, signed with Rhea's scanned
// signature (the same PNG the NDA uses). Details come from the editable intern
// config; anything unset renders as a visible fill-in blank for HR. Both
// letters carry the internship terms: 3-month term, a two-week mutual-fit
// window with no notice, confidentiality, and non-compete.

export type LetterType = 'offer' | 'joining';

// The letters' contact is the company address; correspondence goes to this
// address regardless of the invoicing email.
const CONTACT_EMAIL = 'rhea@heyrhai.com';

const ink = '#1a1a17';
const grey = '#726a5d';
const accent = '#c64a1f';

function blank(value: string, width = 200): { text: string; isBlank: boolean } {
  const v = (value || '').trim();
  return v ? { text: v, isBlank: false } : { text: '_'.repeat(Math.round(width / 6)), isBlank: true };
}

function today(): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());
}

interface BuildParams {
  type: LetterType;
  company: CompanySettings;
  intern: InternConfig;
  signaturePng: Buffer | null;
}

function buildLetterPdf(p: BuildParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 64, bottom: 64, left: 72, right: 72 } });
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 144;
    const left = 72;

    // Letterhead.
    doc.font('Helvetica-Bold').fontSize(17).fillColor(ink).text(p.company.legalName, left, 64, { width: W });
    doc.font('Helvetica').fontSize(9).fillColor(grey);
    doc.text(
      [
        p.company.registeredAddress,
        [p.company.cin ? `CIN: ${p.company.cin}` : null, p.company.gstin ? `GSTIN: ${p.company.gstin}` : null]
          .filter(Boolean)
          .join('   ·   '),
        CONTACT_EMAIL
      ]
        .filter(Boolean)
        .join('\n'),
      left,
      86,
      { width: W }
    );

    const ruleY = 140;
    doc.moveTo(left, ruleY).lineTo(left + W, ruleY).lineWidth(2).strokeColor(accent).stroke();

    const title = p.type === 'offer' ? 'LETTER OF OFFER' : 'LETTER OF JOINING';
    doc.font('Helvetica-Bold').fontSize(14).fillColor(ink).text(title, left, ruleY + 18);
    doc.font('Helvetica').fontSize(9.5).fillColor(grey).text(`Date: ${today()}`, left, ruleY + 18, {
      width: W,
      align: 'right'
    });

    let y = ruleY + 48;
    const name = blank(p.intern.name, 200);
    const stipend = blank(p.intern.stipendLabel, 160);

    doc.font('Helvetica').fontSize(10.5).fillColor(ink);
    doc.text('Dear ', left, y, { continued: true });
    doc.font(name.isBlank ? 'Helvetica' : 'Helvetica-Bold').text(name.text, { continued: true });
    doc.font('Helvetica').text(',');
    y = doc.y + 12;

    const para = (text: string, gap = 10) => {
      doc.font('Helvetica').fontSize(10.5).fillColor(ink).text(text, left, y, { width: W, align: 'left', lineGap: 2.5 });
      y = doc.y + gap;
    };
    const clause = (n: number, heading: string, text: string) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text(`${n}. ${heading}`, left, y, { width: W });
      y = doc.y + 2;
      doc.font('Helvetica').fontSize(10).fillColor(ink).text(text, left, y, { width: W, lineGap: 2.5 });
      y = doc.y + 9;
    };

    if (p.type === 'offer') {
      para(
        `We are delighted to offer you the position of ${p.intern.title} at ${p.company.legalName} ` +
          `("the Company"). This is ${p.intern.termLabel}, with an intended start date of ${p.intern.startDateLabel}. ` +
          `Your focus is the human side of how we work: pipeline management, client success and deployment, our ` +
          `social presence, and helping run the Hang w AI community.`
      );

      // Compensation, with an explicit blank when unset.
      doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text('1. Compensation', left, y, { width: W });
      y = doc.y + 2;
      doc.font('Helvetica').fontSize(10).fillColor(ink);
      doc.text('You will be paid ', left, y, { continued: true });
      doc.font(stipend.isBlank ? 'Helvetica' : 'Helvetica-Bold').fillColor(stipend.isBlank ? grey : ink).text(stipend.text, {
        continued: true
      });
      doc.font('Helvetica').fillColor(ink).text(stipend.isBlank ? '  (to be completed by HR), paid monthly.' : ', paid monthly.');
      y = doc.y + 9;

      clause(
        2,
        'Two-week mutual-fit window',
        'The first two weeks are a mutual trial. During this period either you or the Company may choose to part ways ' +
          'for any reason, with no notice period required on either side and no obligations beyond work already done. ' +
          'We would simply have an honest conversation and wish each other well.'
      );
      clause(
        3,
        'Confidentiality',
        'In this role you will have access to sensitive information about the Company and its clients — pipelines, ' +
          'commercials, strategy, client data, documents, and recordings of client conversations. You agree to keep all ' +
          'such information strictly confidential, to use it only for your work here, and never to disclose or use it ' +
          'outside the Company, both during the internship and after it ends.'
      );
      clause(
        4,
        'Non-compete',
        'During the internship and for six months after it ends, you agree not to work with, advise, or set up a ' +
          'business that directly competes with the Company, and not to solicit the Company’s clients or team for a ' +
          'competing purpose. This is narrow and specific — it protects the trust our clients place in us, and is not ' +
          'meant to stop you learning or building your own career elsewhere.'
      );
      clause(
        5,
        'Where and how you work',
        `Until 4 September you are asked to be at our Judicial Layout office in person. Through September, while the ` +
          `founder is travelling, ${p.intern.pointPerson} will be your point of contact. This offer is subject to your ` +
          `submission of the standard onboarding documents (identity, bank, education, and any prior-employment records).`
      );
      para('We are genuinely glad you are joining us, and we are looking forward to working with you.', 6);
    } else {
      para(
        `This letter confirms that you have joined ${p.company.legalName} as ${p.intern.title}, with effect from ` +
          `${p.intern.startDateLabel}, for ${p.intern.termLabel}. We confirm receipt of your onboarding documents and ` +
          `welcome you formally to the team.`
      );
      clause(
        1,
        'Two-week mutual-fit window',
        'As set out in your offer, the first two weeks are a mutual trial: either side may part ways with no notice ' +
          'period and no further obligation. After that, the internship continues for the agreed term.'
      );
      clause(
        2,
        'Confidentiality',
        'You will handle sensitive Company and client information. You agree to keep it strictly confidential, to use ' +
          'it only for your work here, and never to disclose or use it outside the Company, during and after your time ' +
          'with us.'
      );
      clause(
        3,
        'Non-compete',
        'During the internship and for six months after, you agree not to join or advise a direct competitor, and not ' +
          'to solicit our clients or team for a competing purpose.'
      );
      para(
        `${p.intern.pointPerson} is your point of contact for the coming month. Your day-to-day covers pipeline ` +
          `management, client success, social media, and community — and above all, getting better at the human part ` +
          `of what we do. We are glad you are here.`,
        6
      );
    }

    // Sign-off with the scanned signature stamped in.
    y += 10;
    doc.font('Helvetica').fontSize(10.5).fillColor(ink).text('Warmly,', left, y);
    y = doc.y + 6;
    if (p.signaturePng) {
      try {
        doc.image(p.signaturePng, left, y, { fit: [150, 46] });
        y += 48;
      } catch {
        y += 30;
      }
    } else {
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(grey).text('(signature on file)', left, y + 6);
      y += 30;
    }
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(ink).text('Rhea Karuturi', left, y);
    doc.font('Helvetica').fontSize(9.5).fillColor(grey).text(`for ${p.company.legalName}`, left, doc.y + 1);

    // Countersignature line for the intern.
    const cy = doc.y + 24;
    doc.font('Helvetica').fontSize(9.5).fillColor(ink).text('Accepted and agreed:', left, cy);
    doc.text('_______________________', left, cy + 22);
    doc.font('Helvetica').fontSize(9).fillColor(grey).text(
      `${name.isBlank ? 'Name' : name.text}  ·  Date: ____________`,
      left,
      cy + 26
    );

    doc.font('Helvetica-Oblique').fontSize(8).fillColor(grey).text(
      'Please review, complete any blank fields, sign both copies, and return one to us.',
      left,
      doc.page.height - 54,
      { width: W, align: 'center' }
    );

    doc.end();
  });
}

export async function generateLetter(type: LetterType): Promise<{ buffer: Buffer; filename: string }> {
  const [company, intern, signaturePng] = await Promise.all([
    loadCompanySettings(),
    loadInternConfig(),
    loadSignaturePng()
  ]);
  const buffer = await buildLetterPdf({ type, company, intern, signaturePng });
  const who = (intern.name || 'intern').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const filename = `rhai-${type}-letter-${who}.pdf`;
  return { buffer, filename };
}
