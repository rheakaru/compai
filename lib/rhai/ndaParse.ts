import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, parseJsonLoose } from './server';
import { modelFor } from './models';
import type { TrackedDocKind } from './docTracking';
import type { WorkshopLead } from '@/lib/leads/types';

// ---------------------------------------------------------------------------
// The document-parsing "skill": deterministic-first. Rhea's generated NDAs
// follow a strict filename convention, so their client + date read off the
// name with ZERO model calls. Anything looser tries the filename first and
// only pays for ONE Haiku call — on the PDF's embedded TEXT layer, never on
// page-images — when the date can't be read from the name. suggestLead reuses
// the fireflies token-match style to point each file at a lead.
// ---------------------------------------------------------------------------

// Her convention: NDA_{Client_Name_With_Underscores}_Rhea_Karuturi_{YYYY-MM-DD}.pdf
const NDA_CONVENTION = /^NDA_(.+?)_Rhea_Karuturi_(\d{4}-\d{2}-\d{2})\.pdf$/i;

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
};

// Filename tokens that are never part of a client's name.
const NOISE = new Set([
  'nda', 'ndas', 'mnda', 'mutual', 'nondisclosure', 'agreement', 'signed',
  'final', 'draft', 'rhea', 'karuturi', 'proposal', 'copy', 'the', 'and',
  'ltd', 'llp', 'pvt', 'inc'
]);

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Pull a YYYY-MM-DD, or a "12-Jul-2026"/"12 July 2026" style date, out of a string. */
function findDate(s: string): string | null {
  const isoMatch = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoMatch) {
    const y = +isoMatch[1], m = +isoMatch[2], d = +isoMatch[3];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return iso(y, m, d);
  }
  const named = /(\d{1,2})[-_ ]([A-Za-z]{3,9})[-_ ](\d{4})/.exec(s);
  if (named) {
    const d = +named[1];
    const m = MONTHS[named[2].toLowerCase()];
    const y = +named[3];
    if (m && d >= 1 && d <= 31) return iso(y, m, d);
  }
  return null;
}

/** Strip the date + noise tokens off a filename and keep the rest as a name. */
function candidateName(base: string): string | null {
  const stripped = base
    .replace(/\d{4}-\d{2}-\d{2}/g, ' ')
    .replace(/\d{1,2}[-_ ][A-Za-z]{3,9}[-_ ]\d{4}/g, ' ');
  const kept = stripped
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .filter(t => {
      const low = t.toLowerCase();
      if (NOISE.has(low)) return false;
      if (MONTHS[low]) return false;
      if (/^v\d+$/i.test(t)) return false; // version tags v1..v9
      if (/^\d+$/.test(t)) return false; // stray numbers
      return true;
    });
  const name = kept.join(' ').trim();
  return name || null;
}

export interface FastParse {
  docDate: string | null; // YYYY-MM-DD
  clientName: string | null;
  source: 'filename';
}

/** Deterministic filename parse — zero model calls. */
export function parseDocFast(filename: string, _kind: TrackedDocKind): FastParse {
  const m = NDA_CONVENTION.exec(filename);
  if (m) {
    const clientName = m[1].replace(/_/g, ' ').trim();
    return { docDate: m[2], clientName: clientName || null, source: 'filename' };
  }
  const base = filename.replace(/\.[A-Za-z0-9]+$/, '');
  return { docDate: findDate(base), clientName: candidateName(base), source: 'filename' };
}

// ---------------------------------------------------------------------------
// Model path — ONE Haiku call. For PDFs, pull the embedded text layer with
// pdf-parse (no model) and send only the first ~6000 chars of TEXT. Only a
// scanned/image PDF (thin text layer) falls back to the PDF-vision block.
// ---------------------------------------------------------------------------

const TEXT_LAYER_FLOOR = 200; // <this many chars ⇒ treat as scanned, use vision
const TEXT_LAYER_CHARS = 6000;

/** Extract a PDF's embedded text without a model. Returns '' on any failure. */
async function extractPdfTextLayer(buffer: Buffer): Promise<string> {
  try {
    // Import the lib entry directly: the package index runs a debug harness
    // that reads a bundled sample PDF when it has no module parent, which
    // throws under a bundler. The lib file is the pure function.
    // @ts-expect-error — no type declarations for the subpath import
    const mod = await import('pdf-parse/lib/pdf-parse.js');
    const pdf = (mod.default ?? mod) as (b: Buffer) => Promise<{ text?: string }>;
    const data = await pdf(buffer);
    return (data.text ?? '').trim();
  } catch {
    return '';
  }
}

export interface ModelParse {
  docDate: string | null;
  clientName: string | null;
  parties: string[];
}

function dateHintFor(kind: TrackedDocKind): string {
  return kind === 'nda' || kind === 'nda-signed'
    ? 'For an NDA, the date is its EFFECTIVE DATE (usually in the opening block: "entered into on…" / "executed on…").'
    : "Use the document's issue/sent date (the date printed on it, not any deadline inside it).";
}

const PROMPT_HEAD = (kind: TrackedDocKind, filename: string) =>
  [
    'Read this business document and return ONLY a JSON object — no prose, no code fence:',
    '{',
    '  "docDate": "YYYY-MM-DD" | null,   // the date ON the document; null if none is readable',
    '  "clientName": "..." | null,        // the CLIENT company/person — NOT Rhea Karuturi / "the Consultant"',
    '  "parties": ["..."]                 // all named parties (companies or people), max 4',
    '}',
    dateHintFor(kind),
    `Filename: ${filename}`,
    'Never guess a date — null beats a wrong date.'
  ].join('\n');

/** ONE model call for date/client/parties. Text-layer first; vision only for scans/images. */
export async function parseDocMetaModel(
  buffer: Buffer,
  mime: string,
  kind: TrackedDocKind,
  filename = ''
): Promise<ModelParse> {
  const isPdf = mime === 'application/pdf';
  const isImage = mime.startsWith('image/');
  if (!isPdf && !isImage) return { docDate: null, clientName: null, parties: [] };

  const prompt = PROMPT_HEAD(kind, filename);
  let content: Anthropic.Messages.MessageParam['content'];

  if (isPdf) {
    const layer = await extractPdfTextLayer(buffer);
    if (layer.length >= TEXT_LAYER_FLOOR) {
      content = [
        { type: 'text', text: `${prompt}\n\nDOCUMENT TEXT (first part):\n${layer.slice(0, TEXT_LAYER_CHARS)}` }
      ] as unknown as Anthropic.Messages.MessageParam['content'];
    } else {
      // Scanned/image PDF — no usable text layer. Fall back to native PDF vision.
      content = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } },
        { type: 'text', text: prompt }
      ] as unknown as Anthropic.Messages.MessageParam['content'];
    }
  } else {
    content = [
      { type: 'image', source: { type: 'base64', media_type: mime, data: buffer.toString('base64') } },
      { type: 'text', text: prompt }
    ] as unknown as Anthropic.Messages.MessageParam['content'];
  }

  try {
    const msg = await anthropic().messages.create({
      model: modelFor('draft'),
      max_tokens: 400,
      messages: [{ role: 'user', content }]
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');
    const raw = parseJsonLoose<{ docDate?: unknown; clientName?: unknown; parties?: unknown }>(text);
    const docDate =
      typeof raw.docDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.docDate) ? raw.docDate : null;
    const clientName =
      typeof raw.clientName === 'string' && raw.clientName.trim() ? raw.clientName.trim() : null;
    const parties = Array.isArray(raw.parties)
      ? raw.parties.filter((p): p is string => typeof p === 'string' && !!p.trim()).slice(0, 4)
      : [];
    return { docDate, clientName, parties };
  } catch {
    // Missing API key or a model hiccup — the filename fast-path still stands.
    return { docDate: null, clientName: null, parties: [] };
  }
}

// ---------------------------------------------------------------------------
// suggestLead — token match (fireflies style) from clientName + filename onto
// lead.person / lead.company.
// ---------------------------------------------------------------------------

/** Meaningful lowercase tokens (len ≥ 3), dropping generic/legal noise. */
function tokens(s: string | undefined): string[] {
  return (s ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !NOISE.has(t));
}

export function leadLabel(l: Pick<WorkshopLead, 'person' | 'company'>): string {
  return [l.person, l.company].filter(Boolean).join(' — ') || '(unnamed lead)';
}

export interface LeadSuggestion {
  leadId: string;
  label: string;
  confidence: 'high' | 'low';
}

/**
 * Point a document at a lead. A whole distinctive token (len ≥ 4) shared
 * between the doc's client/filename and a lead's person/company is a 'high'
 * match; weak/partial overlaps are 'low'; nothing shared is null.
 */
export function suggestLead(
  clientName: string | null,
  filename: string,
  leads: WorkshopLead[]
): LeadSuggestion | null {
  const query = new Set([...tokens(clientName ?? ''), ...tokens(filename)]);
  if (query.size === 0) return null;

  let best: { lead: WorkshopLead; score: number; whole: boolean } | null = null;
  for (const lead of leads) {
    const leadToks = new Set([...tokens(lead.person), ...tokens(lead.company)]);
    if (leadToks.size === 0) continue;
    let score = 0;
    let whole = false;
    for (const t of leadToks) {
      if (query.has(t)) {
        score += t.length >= 4 ? 3 : 1;
        if (t.length >= 4) whole = true;
      } else {
        for (const q of query) {
          if (q.length >= 4 && t.length >= 4 && (q.includes(t) || t.includes(q))) {
            score += 1;
            break;
          }
        }
      }
    }
    if (score === 0) continue;
    // Higher score wins; break ties toward the more recently updated lead.
    if (!best || score > best.score || (score === best.score && (lead.updatedAt ?? 0) > (best.lead.updatedAt ?? 0))) {
      best = { lead, score, whole };
    }
  }
  if (!best) return null;
  return { leadId: best.lead.id, label: leadLabel(best.lead), confidence: best.whole ? 'high' : 'low' };
}

// ---------------------------------------------------------------------------
// parseOne — fast-path first, model only when the date is still missing,
// suggestLead always.
// ---------------------------------------------------------------------------

export interface ParseOneResult {
  docDate: string | null;
  clientName: string | null;
  parties?: string[];
  suggestedLeadId: string | null;
  suggestedLeadLabel: string | null;
  confidence: 'high' | 'low' | null;
  usedModel: boolean;
}

export async function parseOne(
  buffer: Buffer,
  filename: string,
  mime: string,
  kind: TrackedDocKind,
  leads: WorkshopLead[]
): Promise<ParseOneResult> {
  const fast = parseDocFast(filename, kind);
  let docDate = fast.docDate;
  let clientName = fast.clientName;
  let parties: string[] | undefined;
  let usedModel = false;

  if (!docDate) {
    const model = await parseDocMetaModel(buffer, mime, kind, filename);
    usedModel = true;
    docDate = model.docDate ?? docDate;
    clientName = clientName || model.clientName;
    if (model.parties.length) parties = model.parties;
  }

  const suggestion = suggestLead(clientName, filename, leads);
  return {
    docDate,
    clientName,
    parties,
    suggestedLeadId: suggestion?.leadId ?? null,
    suggestedLeadLabel: suggestion?.label ?? null,
    confidence: suggestion?.confidence ?? null,
    usedModel
  };
}
