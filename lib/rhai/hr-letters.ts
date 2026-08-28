import 'server-only';
import PDFDocument from 'pdfkit';
import { loadCompanySettings, type CompanySettings } from './company';
import { INTERN, type InternConfig } from './onboarding';

// Offer + joining letters for a new hire, under RHAI CONSULTING GROUP PRIVATE
// LIMITED, on the same letterhead as the invoices. These are DRAFTS: anything
// not filled in on INTERN (name, stipend) renders as a visible underlined blank
// for HR to complete, and the signature line is left for Rhea. Nothing here
// asserts a figure or a name we don't actually have.

export type LetterType = 'offer' | 'joining';

const ink = '#1a1a17';
const grey = '#726a5d';
const accent = '#c64a1f';

function blank(value: string, width = 200): { text: string; isBlank: boolean } {
  const v = (value || '').trim();
  return v ? { text: v, isBlank: false } : { text: '_'.repeat(Math.round(width / 6)), isBlank: true };
}

function today(): string {
  // Server locale is unreliable; format explicitly in en-IN.
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
}

function buildLetterPdf(p: BuildParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 72, bottom: 72, left: 72, right: 72 } });
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 144; // content width
    const left = 72;

    // Letterhead.
    doc.font('Helvetica-Bold').fontSize(17).fillColor(ink).text(p.company.legalName, left, 72, { width: W });
    doc.font('Helvetica').fontSize(9).fillColor(grey);
    doc.text(
      [
        p.company.registeredAddress,
        [p.company.cin ? `CIN: ${p.company.cin}` : null, p.company.gstin ? `GSTIN: ${p.company.gstin}` : null]
          .filter(Boolean)
          .join('   ·   '),
        p.company.email
      ]
        .filter(Boolean)
        .join('\n'),
      left,
      94,
      { width: W }
    );

    // Accent rule.
    const ruleY = 150;
    doc.moveTo(left, ruleY).lineTo(left + W, ruleY).lineWidth(2).strokeColor(accent).stroke();

    // Title + date.
    const title = p.type === 'offer' ? 'LETTER OF OFFER' : 'LETTER OF JOINING';
    doc.font('Helvetica-Bold').fontSize(15).fillColor(ink).text(title, left, ruleY + 22);
    doc.font('Helvetica').fontSize(9.5).fillColor(grey).text(`Date: ${today()}`, left, ruleY + 22, {
      width: W,
      align: 'right'
    });

    let y = ruleY + 58;
    const name = blank(p.intern.name, 200);
    const stipend = blank(p.intern.stipendLabel, 180);

    // Salutation.
    doc.font('Helvetica').fontSize(10.5).fillColor(ink);
    doc.text('Dear ', left, y, { continued: true });
    doc.font(name.isBlank ? 'Helvetica' : 'Helvetica-Bold').text(name.text, { continued: true });
    doc.font('Helvetica').text(',');
    y = doc.y + 14;

    const para = (text: string) => {
      doc.font('Helvetica').fontSize(10.5).fillColor(ink).text(text, left, y, { width: W, align: 'left', lineGap: 3 });
      y = doc.y + 12;
    };

    if (p.type === 'offer') {
      para(
        `We are delighted to offer you the position of ${p.intern.title} at ${p.company.legalName} ("the Company"). ` +
          `This offer is for ${p.intern.termLabel}, with an intended start date of ${p.intern.startDateLabel}.`
      );

      // Compensation line with an explicit blank when unset.
      doc.font('Helvetica').fontSize(10.5).fillColor(ink);
      doc.text('Your compensation will be ', left, y, { continued: true });
      doc.font(stipend.isBlank ? 'Helvetica' : 'Helvetica-Bold').fillColor(stipend.isBlank ? grey : ink).text(stipend.text, { continued: true });
      doc.font('Helvetica').fillColor(ink).text(
        stipend.isBlank ? '  (to be completed by HR), paid monthly.' : ', paid monthly.'
      );
      y = doc.y + 12;

      para(
        'Your focus for this engagement is the human side of how we work: pipeline management across the ' +
          'organisations we sell into, client success and deployment after we hand over a solution, our social ' +
          'presence, and helping run the Hang w AI community. You will be supported closely and given real ownership early.'
      );
      para(
        `Until 4 September you are asked to be at our Judicial Layout office in person, to get a first-hand feel for the ` +
          `work. Through September, while the founder is travelling, ${p.intern.pointPerson} will be your point of contact.`
      );
      para(
        'This offer is subject to your submission of the standard onboarding documents (identity, bank, education, and ' +
          'prior-employment records) and to our mutual confidentiality terms. We are genuinely glad you are joining us.'
      );
    } else {
      para(
        `This letter confirms that you have joined ${p.company.legalName} as ${p.intern.title}, with effect from ` +
          `${p.intern.startDateLabel}, for ${p.intern.termLabel}.`
      );
      para(
        'We confirm receipt of your onboarding documents and welcome you formally to the team. Your day-to-day work ' +
          'covers pipeline management, client success, social media, and community — and above all, getting better at ' +
          'the human part of what we do.'
      );
      para(
        `${p.intern.pointPerson} is your point of contact for the coming month. We look forward to building alongside you.`
      );
    }

    // Sign-off.
    y += 18;
    doc.font('Helvetica').fontSize(10.5).fillColor(ink).text('Warmly,', left, y);
    y = doc.y + 40;
    doc.text('_______________________', left, y);
    y = doc.y + 4;
    doc.font('Helvetica-Bold').fontSize(10.5).text('Rhea Karuturi', left, y);
    doc.font('Helvetica').fontSize(9.5).fillColor(grey).text(`for ${p.company.legalName}`, left, doc.y + 2);

    // Draft footer.
    doc.font('Helvetica-Oblique').fontSize(8).fillColor(grey).text(
      'Draft — review, complete any blank fields, and sign before issuing.',
      left,
      doc.page.height - 60,
      { width: W, align: 'center' }
    );

    doc.end();
  });
}

export async function generateLetter(type: LetterType): Promise<{ buffer: Buffer; filename: string }> {
  const company = await loadCompanySettings();
  const buffer = await buildLetterPdf({ type, company, intern: INTERN });
  const who = (INTERN.name || 'intern').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const filename = `rhai-${type}-letter-${who}.pdf`;
  return { buffer, filename };
}
