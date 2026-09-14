import 'server-only';
import PDFDocument from 'pdfkit';
import mammoth from 'mammoth';
import { loadCompanySettings, type CompanySettings } from './company';

// Letterhead tool — take a Word (.docx) document the operator drops in and hand
// back a PDF of the same content laid out under the RHAI CONSULTING GROUP
// letterhead (the same header the invoices and HR letters carry: legal name,
// registered office, CIN/GSTIN, contact). The body keeps headings, bold/italic,
// and lists; tables are flattened to their text and images are dropped — this
// is a letter/memo/policy stamper, not a full Word→PDF converter.

const ink = '#1a1a17';
const grey = '#726a5d';
const accent = '#c64a1f';
const CONTACT_EMAIL = 'rhea@heyrhai.com';

// ---------------------------------------------------------------------------
// Parse mammoth's clean semantic HTML into a flat list of layout blocks.
// mammoth normalises any .docx to a small, predictable tag set, so a light
// tokenizer is enough — no HTML parser dependency.
// ---------------------------------------------------------------------------

interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
}
type BlockType = 'h1' | 'h2' | 'h3' | 'p' | 'li';
interface Block {
  type: BlockType;
  runs: Run[];
  /** For list items: the rendered bullet/number marker. */
  marker?: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function htmlToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  // Token stream: tags and the text between them.
  const tokens = html.split(/(<[^>]+>)/);

  // Inline formatting + list context, tracked as we stream.
  let bold = 0;
  let italic = 0;
  const listStack: { ordered: boolean; n: number }[] = [];
  let current: Block | null = null;

  const startBlock = (type: BlockType, marker?: string): Block => {
    const b: Block = { type, runs: [], marker };
    blocks.push(b);
    current = b;
    return b;
  };
  const pushText = (raw: string) => {
    const text = decodeEntities(raw).replace(/\s+/g, ' ');
    if (!text) return;
    const blk = current ?? startBlock('p');
    // Drop a leading space at the very start of a block.
    if (blk.runs.length === 0 && text === ' ') return;
    blk.runs.push({ text, bold: bold > 0, italic: italic > 0 });
  };
  // Append a raw run only when a block is already open (br, cell separators).
  const appendToOpen = (run: Run) => {
    if (current) (current as Block).runs.push(run);
  };

  for (const tok of tokens) {
    if (!tok) continue;
    if (tok[0] !== '<') {
      pushText(tok);
      continue;
    }
    const m = /^<\s*(\/?)\s*([a-zA-Z0-9]+)/.exec(tok);
    if (!m) continue;
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();

    switch (tag) {
      case 'strong':
      case 'b':
        bold += closing ? -1 : 1;
        break;
      case 'em':
      case 'i':
        italic += closing ? -1 : 1;
        break;
      case 'br':
        appendToOpen({ text: '\n' });
        break;
      case 'h1':
      case 'h2':
      case 'h3':
        if (!closing) startBlock('h1' === tag ? 'h1' : tag === 'h2' ? 'h2' : 'h3');
        else current = null;
        break;
      case 'h4':
      case 'h5':
      case 'h6':
        if (!closing) startBlock('h3');
        else current = null;
        break;
      case 'p':
        if (!closing) startBlock('p');
        else current = null;
        break;
      case 'ul':
        if (!closing) listStack.push({ ordered: false, n: 0 });
        else listStack.pop();
        break;
      case 'ol':
        if (!closing) listStack.push({ ordered: true, n: 0 });
        else listStack.pop();
        break;
      case 'li': {
        if (!closing) {
          const ctx = listStack[listStack.length - 1];
          const depth = Math.max(0, listStack.length - 1);
          const indent = '   '.repeat(depth);
          let marker = `${indent}•  `;
          if (ctx?.ordered) {
            ctx.n += 1;
            marker = `${indent}${ctx.n}.  `;
          }
          startBlock('li', marker);
        } else current = null;
        break;
      }
      // Flatten table cells into readable text on a single paragraph row.
      case 'tr':
        if (!closing) startBlock('p');
        else current = null;
        break;
      case 'td':
      case 'th':
        if (closing) appendToOpen({ text: '   ' });
        break;
      default:
        break;
    }
  }

  // Drop blocks that ended up with no visible text.
  return blocks.filter(b => b.runs.some(r => r.text.trim()));
}

// ---------------------------------------------------------------------------
// Render.
// ---------------------------------------------------------------------------

function fontFor(r: Run): string {
  if (r.bold && r.italic) return 'Helvetica-BoldOblique';
  if (r.bold) return 'Helvetica-Bold';
  if (r.italic) return 'Helvetica-Oblique';
  return 'Helvetica';
}

function drawLetterhead(doc: PDFKit.PDFDocument, company: CompanySettings, W: number, left: number) {
  doc.font('Helvetica-Bold').fontSize(17).fillColor(ink).text(company.legalName, left, 50, { width: W });
  doc.font('Helvetica').fontSize(9).fillColor(grey);
  const idLine = [company.cin ? `CIN: ${company.cin}` : null, company.gstin ? `GSTIN: ${company.gstin}` : null]
    .filter(Boolean)
    .join('   ·   ');
  const contact = `${company.email && /@heyrhai\.com$/i.test(company.email) ? company.email : CONTACT_EMAIL}   ·   heyrhai.com`;
  doc.text([company.registeredAddress, idLine, contact].filter(Boolean).join('\n'), left, 72, { width: W });
  doc
    .moveTo(left, 130)
    .lineTo(left + W, 130)
    .lineWidth(2)
    .strokeColor(accent)
    .stroke();
}

function drawContinuationHeader(doc: PDFKit.PDFDocument, company: CompanySettings, W: number, left: number) {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(grey).text(company.legalName, left, 40, { width: W });
  doc
    .moveTo(left, 58)
    .lineTo(left + W, 58)
    .lineWidth(0.75)
    .strokeColor('#d8d2c6')
    .stroke();
}

function buildPdf(blocks: Block[], company: CompanySettings): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 84, bottom: 72, left: 64, right: 64 },
      bufferPages: true
    });
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 64;
    const W = doc.page.width - 128;

    // Continuation pages get a slim header; the first page (created before this
    // listener is attached) gets the full letterhead below.
    doc.on('pageAdded', () => drawContinuationHeader(doc, company, W, left));

    drawLetterhead(doc, company, W, left);
    doc.y = 152; // start the body below the accent rule
    doc.x = left;

    for (const b of blocks) {
      const gapBefore = b.type === 'h1' ? 14 : b.type === 'h2' ? 12 : b.type === 'h3' ? 10 : 6;
      doc.y += gapBefore;

      const isHeading = b.type.startsWith('h');
      const size = b.type === 'h1' ? 15 : b.type === 'h2' ? 12.5 : b.type === 'h3' ? 11 : 10.5;
      const startX = b.type === 'li' ? left + 6 : left;

      // Marker for list items, rendered inline before the first run.
      if (b.marker) {
        doc.font('Helvetica').fontSize(size).fillColor(ink).text(b.marker, startX, doc.y, { continued: true });
      }

      const runs = b.runs.length ? b.runs : [{ text: '' }];
      runs.forEach((r, i) => {
        const isLast = i === runs.length - 1;
        const font = isHeading ? 'Helvetica-Bold' : fontFor(r);
        doc
          .font(font)
          .fontSize(size)
          .fillColor(ink)
          .text(r.text, { continued: !isLast, width: W - (startX - left), lineGap: 2.5, align: 'left' });
      });
    }

    // Footer on every page — drawn after content, in a buffered post-pass so a
    // bottom-of-page position never triggers auto-pagination. Guard the bottom
    // margin to 0 while writing so the single line fits.
    const range = doc.bufferedPageRange();
    const footer = `${company.legalName}${company.gstin ? `  ·  GSTIN ${company.gstin}` : ''}`;
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const saveBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font('Helvetica-Oblique')
        .fontSize(8)
        .fillColor(grey)
        .text(footer, left, doc.page.height - 44, { width: W, align: 'center', lineBreak: false });
      doc.page.margins.bottom = saveBottom;
    }
    doc.flushPages();

    doc.end();
  });
}

/**
 * Convert a .docx buffer to a letterheaded PDF. Throws a user-facing Error
 * when the file can't be read or has no text.
 */
export async function renderLetterheadPdf(docxBuffer: Buffer): Promise<Buffer> {
  let html: string;
  try {
    const result = await mammoth.convertToHtml({ buffer: docxBuffer });
    html = result.value;
  } catch {
    throw new Error('Could not read that file. Only Word .docx files are supported (not the older .doc format).');
  }
  const blocks = htmlToBlocks(html);
  if (blocks.length === 0) {
    throw new Error('That document appears to be empty — no text to place on the letterhead.');
  }
  const company = await loadCompanySettings();
  return buildPdf(blocks, company);
}

/** Turn the uploaded filename into a sensible letterheaded output name. */
export function letterheadFilename(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'document';
  return `${base}-letterhead.pdf`;
}
