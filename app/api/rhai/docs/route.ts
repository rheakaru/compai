import { NextRequest } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import { anthropic, parseJsonLoose, requireOperator } from '@/lib/rhai/server';
import { modelFor } from '@/lib/rhai/models';
import { extractText } from '@/lib/rhai/extract';
import { COL_INVOICES } from '@/lib/rhai/invoice-server';
import type { RhaiInvoice } from '@/lib/rhai/invoices';
import { normalizeLead, type LeadDocument, type WorkshopLead } from '@/lib/leads/types';
import {
  TRACKED_DOC_KINDS,
  isoToMs,
  type DealRow,
  type MilestoneSet,
  type TrackedDocKind,
  type TrackedDoc
} from '@/lib/rhai/docTracking';

// Document tracker for deal velocity. GET derives the milestone timeline for
// every lead — first call → NDA sent → NDA signed → proposal → invoice — from
// documents + noteSessions + stage history + the invoice tracker. Nothing is
// stored; the timeline is recomputed on every read so it can't drift.
// POST uploads a sent/received document against a lead (same storage layout as
// lead documents) and has Claude read the date on it + the parties.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_BYTES = 25 * 1024 * 1024; // 25MB — matches the lead documents route

const COL_LEADS = 'workshopLeads';

// --- name matching (invoice.client → lead) ---------------------------------
const NOISE_TOKENS = new Set(['the', 'and', 'ltd', 'llp', 'pvt', 'inc', 'private', 'limited', 'co', 'company']);

/** Normalised comparison key: lowercase alphanumerics, entity suffixes dropped. */
function nameKey(s: string | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 2 && !NOISE_TOKENS.has(t))
    .join(' ')
    .trim();
}

/** True if the two keys share a distinctive (len ≥ 4) token. */
function sharesDistinctiveToken(a: string, b: string): boolean {
  const bt = new Set(b.split(' ').filter(t => t.length >= 4));
  return a.split(' ').some(t => t.length >= 4 && bt.has(t));
}

// ---------------------------------------------------------------------------
// GET — the aggregated deal timeline
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const [leadsSnap, invoicesSnap, ndasSnap] = await Promise.all([
    adminDb().collection(COL_LEADS).get(),
    adminDb().collection(COL_INVOICES).get(),
    adminDb().collection('rhaiNdas').select('leadId', 'clientLegalName').get()
  ]);

  const leads = leadsSnap.docs.map(d =>
    normalizeLead({ id: d.id, ...(d.data() as Omit<WorkshopLead, 'id'>) })
  );

  // Build a name→lead index so invoices (and other records) that carry only a
  // company/person name — not a leadId — still map to their deal. Aliases per
  // lead: the lead's person + company, PLUS the legal name(s) from any NDA we
  // generated for that lead (that's where the full "…Private Limited" lives).
  const ndaNamesByLead = new Map<string, string[]>();
  for (const d of ndasSnap.docs) {
    const { leadId, clientLegalName } = d.data() as { leadId?: string; clientLegalName?: string };
    if (leadId && clientLegalName) {
      ndaNamesByLead.set(leadId, [...(ndaNamesByLead.get(leadId) ?? []), clientLegalName]);
    }
  }
  const matchNameToLead = (name: string): string | undefined => {
    const q = nameKey(name);
    if (!q) return undefined;
    let best: { leadId: string; score: number } | undefined;
    for (const lead of leads) {
      const aliases = [lead.company, lead.person, ...(ndaNamesByLead.get(lead.id) ?? [])];
      let score = 0;
      for (const alias of aliases) {
        const a = nameKey(alias);
        if (!a) continue;
        if (a === q) score = Math.max(score, 3);
        else if (a.includes(q) || q.includes(a)) score = Math.max(score, 2);
        else if (sharesDistinctiveToken(a, q)) score = Math.max(score, 1);
      }
      if (score > 0 && (!best || score > best.score)) best = { leadId: lead.id, score };
    }
    return best?.leadId;
  };

  // Dated invoices by lead — only ones actually sent (or paid) count. Match by
  // explicit leadId first, then fall back to the invoice's `client` name.
  const invoiceDates = new Map<string, number>();
  for (const d of invoicesSnap.docs) {
    const inv = d.data() as Omit<RhaiInvoice, 'id'>;
    if (inv.status !== 'sent' && inv.status !== 'paid') continue;
    const leadId = inv.leadId || matchNameToLead(inv.client ?? '');
    if (!leadId) continue;
    const at = isoToMs(inv.issueDate) ?? inv.createdAt;
    const prev = invoiceDates.get(leadId);
    if (prev === undefined || at < prev) invoiceDates.set(leadId, at);
  }

  const rows = await Promise.all(
    leads.map(async (lead): Promise<DealRow> => {
      const ref = adminDb().collection(COL_LEADS).doc(lead.id);
      const [docsSnap, notesSnap, historySnap] = await Promise.all([
        ref.collection('documents').select('name', 'kind', 'origin', 'docDate', 'createdAt').get(),
        ref.collection('noteSessions').select('source', 'at').get(),
        ref.collection('history').select('field', 'value', 'at').get()
      ]);

      const milestones: MilestoneSet = {};
      const earliest = (key: keyof MilestoneSet, at: number | undefined) => {
        if (typeof at !== 'number') return;
        if (milestones[key] === undefined || at < milestones[key]!) milestones[key] = at;
      };

      // First call — earliest real call session, else when the lead was created.
      for (const n of notesSnap.docs) {
        const { source, at } = n.data() as { source?: string; at?: number };
        if (source === 'transcribed' || source === 'voice') earliest('firstCall', at);
      }
      if (milestones.firstCall === undefined) milestones.firstCall = lead.createdAt;

      // Documents — the date ON the document wins over the upload timestamp.
      // Generated NDAs register with kind 'nda' too, so they're picked up here.
      const documents: TrackedDoc[] = [];
      for (const d of docsSnap.docs) {
        const data = d.data() as Pick<LeadDocument, 'name' | 'kind' | 'origin' | 'docDate' | 'createdAt'>;
        const at = data.docDate ?? data.createdAt;
        if (data.kind === 'nda') earliest('ndaSent', at);
        else if (data.kind === 'nda-signed') earliest('ndaSigned', at);
        else if (data.kind === 'proposal') earliest('proposalSent', at);
        if (TRACKED_DOC_KINDS.includes(data.kind as TrackedDocKind)) {
          documents.push({
            id: d.id,
            name: data.name,
            kind: data.kind,
            origin: data.origin,
            at,
            docDate: data.docDate ?? null
          });
        }
      }

      // Invoice sent — dated invoice first, then the stage-change log, then the
      // undated checklist flag as a last resort.
      let invoiceSentNoDate = false;
      earliest('invoiceSent', invoiceDates.get(lead.id));
      if (milestones.invoiceSent === undefined) {
        for (const h of historySnap.docs) {
          const { field, value, at } = h.data() as { field?: string; value?: unknown; at?: number };
          if (field === 'stage' && value === 'invoiced') earliest('invoiceSent', at);
        }
      }
      if (milestones.invoiceSent === undefined && lead.checklist?.invoiceSent) invoiceSentNoDate = true;

      documents.sort((a, b) => b.at - a.at);
      return {
        leadId: lead.id,
        person: lead.person,
        company: lead.company,
        stage: lead.stage,
        milestones,
        ...(invoiceSentNoDate ? { invoiceSentNoDate } : {}),
        documents
      };
    })
  );

  // Most recent activity first — the deals moving now float to the top.
  const latest = (r: DealRow) => Math.max(...Object.values(r.milestones).filter((v): v is number => v != null), 0);
  rows.sort((a, b) => latest(b) - latest(a));

  return Response.json({ rows, generatedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// PATCH — correct a tracked document's date or kind after upload
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const body = (await req.json().catch(() => null)) as {
    leadId?: string;
    docId?: string;
    docDate?: string | null; // 'YYYY-MM-DD' to set, null to clear, undefined to leave
    kind?: TrackedDocKind;
  } | null;
  const leadId = body?.leadId?.trim();
  const docId = body?.docId?.trim();
  if (!leadId || !docId) return new Response('leadId and docId required', { status: 400 });

  const docRef = adminDb().collection(COL_LEADS).doc(leadId).collection('documents').doc(docId);
  if (!(await docRef.get()).exists) return new Response('document not found', { status: 404 });

  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  if (body?.kind !== undefined) {
    if (!TRACKED_DOC_KINDS.includes(body.kind)) {
      return new Response(`kind must be one of: ${TRACKED_DOC_KINDS.join(', ')}`, { status: 400 });
    }
    patch.kind = body.kind;
  }
  if (body?.docDate !== undefined) {
    if (body.docDate === null || body.docDate === '') {
      patch.docDate = FieldValue.delete();
    } else {
      const ms = isoToMs(body.docDate);
      if (ms === undefined) return new Response('docDate must be YYYY-MM-DD', { status: 400 });
      patch.docDate = ms;
    }
  }

  await docRef.update(patch);
  return Response.json({ ok: true });
}

// ---------------------------------------------------------------------------
// POST — upload a sent/received document against a lead
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return new Response('expected a file', { status: 400 });
  if (file.size > MAX_BYTES) return new Response('file too large (max 25MB)', { status: 413 });

  const leadId = String(form?.get('leadId') ?? '').trim();
  if (!leadId) return new Response('leadId required', { status: 400 });
  const kind = String(form?.get('kind') ?? '').trim() as TrackedDocKind;
  if (!TRACKED_DOC_KINDS.includes(kind)) {
    return new Response(`kind must be one of: ${TRACKED_DOC_KINDS.join(', ')}`, { status: 400 });
  }
  const dateOverride = String(form?.get('dateOverride') ?? '').trim(); // 'YYYY-MM-DD' or ''

  const leadRef = adminDb().collection(COL_LEADS).doc(leadId);
  if (!(await leadRef.get()).exists) return new Response('lead not found', { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.slice(0, 200);
  const mime = file.type || 'application/octet-stream';

  // Text body for Rhai's context (same extractor as lead uploads) + the
  // date/parties read, in parallel.
  const [text, meta] = await Promise.all([
    extractText(buffer, name, mime).catch(
      e => `(Couldn't extract text from "${name}": ${e instanceof Error ? e.message : 'error'})`
    ),
    extractDocMeta(buffer, mime, kind).catch(() => ({ docDate: null, parties: [] as string[] }))
  ]);

  const docDate = (dateOverride && isoToMs(dateOverride)) || (meta.docDate ? isoToMs(meta.docDate) : undefined);

  const now = Date.now();
  const docRef = leadRef.collection('documents').doc();

  // Same storage layout as the lead documents route.
  let storagePath: string | undefined;
  try {
    storagePath = `leadDocuments/${leadId}/${docRef.id}/${name}`;
    await adminBucket().file(storagePath).save(buffer, { contentType: mime, resumable: false });
  } catch {
    storagePath = undefined;
  }

  const doc: Omit<LeadDocument, 'id'> = {
    name,
    origin: 'uploaded',
    kind,
    text,
    ...(storagePath ? { storagePath } : {}),
    mime,
    sizeBytes: file.size,
    ...(docDate !== undefined ? { docDate } : {}),
    createdAt: now,
    updatedAt: now
  };
  await docRef.set(doc);

  return Response.json({
    document: { id: docRef.id, ...doc, text: undefined, hasText: !!text },
    parsed: {
      docDate: docDate !== undefined ? new Date(docDate).toISOString().slice(0, 10) : null,
      dateSource: dateOverride && isoToMs(dateOverride) ? 'override' : meta.docDate ? 'extracted' : 'none',
      parties: meta.parties
    }
  });
}

// ---------------------------------------------------------------------------
// Claude reads the date on the document + the parties (PDF/image only — for
// other formats the operator's override or the upload time carries the row).
// ---------------------------------------------------------------------------

interface DocMeta {
  docDate: string | null; // 'YYYY-MM-DD'
  parties: string[];
}

async function extractDocMeta(buffer: Buffer, mime: string, kind: TrackedDocKind): Promise<DocMeta> {
  const isPdf = mime === 'application/pdf';
  const isImage = mime.startsWith('image/');
  if (!isPdf && !isImage) return { docDate: null, parties: [] };

  const dateHint =
    kind === 'nda' || kind === 'nda-signed'
      ? 'For an NDA, the date is its EFFECTIVE DATE (usually in the opening block: "entered into on…" / "executed on…").'
      : 'Use the document\'s issue/sent date (the date printed on it, not any deadline inside it).';

  const prompt = [
    'Read this business document and return ONLY a JSON object — no prose, no code fence:',
    '{',
    '  "docDate": "YYYY-MM-DD" | null,  // the date ON the document; null if none is readable',
    '  "parties": ["..."]               // the named parties / sender + recipient (companies or people), max 4',
    '}',
    dateHint,
    'Never guess a date — null beats a wrong date.'
  ].join('\n');

  const source = { type: 'base64', media_type: isPdf ? 'application/pdf' : mime, data: buffer.toString('base64') };
  const msg = await anthropic().messages.create({
    model: modelFor('draft'),
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: [
          { type: isPdf ? 'document' : 'image', source },
          { type: 'text', text: prompt }
        ] as unknown as Anthropic.Messages.MessageParam['content']
      }
    ]
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  try {
    const raw = parseJsonLoose<{ docDate?: unknown; parties?: unknown }>(text);
    const docDate =
      typeof raw.docDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.docDate) ? raw.docDate : null;
    const parties = Array.isArray(raw.parties)
      ? raw.parties.filter((p): p is string => typeof p === 'string' && !!p.trim()).slice(0, 4)
      : [];
    return { docDate, parties };
  } catch {
    return { docDate: null, parties: [] };
  }
}
