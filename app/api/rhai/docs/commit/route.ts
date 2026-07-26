import { NextRequest } from 'next/server';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { classify, extractText } from '@/lib/rhai/extract';
import { TRACKED_DOC_KINDS, isoToMs, type TrackedDocKind } from '@/lib/rhai/docTracking';
import type { LeadDocument, WorkshopLead } from '@/lib/leads/types';

// Commit a reviewed batch: for each row, copy its staged blob onto the lead
// and file a LeadDocument. NDA bodies are boilerplate, so we store a one-line
// marker instead of spending a transcribe call; proposals/other get a cheap
// local text extraction (never the slow PDF-vision transcribe). Best-effort
// per item — one failure never aborts the batch.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const COL_LEADS = 'workshopLeads';
const EXTRACT_SIZE_CAP = 8 * 1024 * 1024; // skip context extraction above this

interface CommitItem {
  stagingId: string;
  name: string;
  mime?: string;
  size?: number;
  leadId: string;
  kind: TrackedDocKind;
  docDate?: string | null; // 'YYYY-MM-DD' or empty/null
}

interface CommitResult {
  stagingId: string | null;
  ok: boolean;
  docId?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const body = (await req.json().catch(() => null)) as { items?: CommitItem[] } | null;
  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return new Response('no items to commit', { status: 400 });
  }

  const results = await Promise.all(items.map(item => commitOne(item)));
  return Response.json({ results });
}

async function commitOne(item: CommitItem): Promise<CommitResult> {
  const stagingId = item?.stagingId ?? null;
  try {
    const { name, mime, size, leadId, kind } = item;
    const docDateIso = (item.docDate ?? '').trim();
    if (!stagingId) throw new Error('missing stagingId');
    if (!leadId) throw new Error('missing leadId');
    if (!TRACKED_DOC_KINDS.includes(kind)) {
      throw new Error(`kind must be one of: ${TRACKED_DOC_KINDS.join(', ')}`);
    }

    const leadRef = adminDb().collection(COL_LEADS).doc(leadId);
    const leadSnap = await leadRef.get();
    if (!leadSnap.exists) throw new Error('lead not found');
    const lead = leadSnap.data() as Omit<WorkshopLead, 'id'>;

    const cleanName = (name || 'file').slice(0, 200);
    const contentType = mime || 'application/octet-stream';
    const now = Date.now();
    const docRef = leadRef.collection('documents').doc();
    const destPath = `leadDocuments/${leadId}/${docRef.id}/${cleanName}`;

    // Locate the staged blob by prefix (decoupled from how the name was
    // sanitized at staging time). Missing ⇒ already committed / staging failed;
    // file the doc anyway, just without a stored original.
    const [staged] = await adminBucket().getFiles({ prefix: `docStaging/${stagingId}/` });
    const src = staged[0];
    let storagePath: string | undefined;
    if (src) {
      try {
        await src.copy(adminBucket().file(destPath));
        storagePath = destPath;
      } catch {
        storagePath = undefined;
      }
    }

    // Lightweight text body. NDAs: a one-line marker (their bodies are
    // boilerplate — no transcribe call). Proposals/other default to the same
    // marker; real extraction is attempted below only for cheap formats.
    const clientLabel = [lead.person, lead.company].filter(Boolean).join(' — ') || leadId;
    const dateStr = docDateIso || 'no date';
    const marker = `Uploaded ${kind} for ${clientLabel}, dated ${dateStr}.`;

    const docDateMs = docDateIso ? isoToMs(docDateIso) : undefined;

    const doc: Omit<LeadDocument, 'id'> = {
      name: cleanName,
      origin: 'uploaded',
      kind,
      text: marker,
      ...(storagePath ? { storagePath } : {}),
      mime: contentType,
      ...(typeof size === 'number' ? { sizeBytes: size } : {}),
      ...(docDateMs !== undefined ? { docDate: docDateMs } : {}),
      createdAt: now,
      updatedAt: now
    };
    await docRef.set(doc);

    // Proposals/other: enrich with real text AFTER the doc is written, and
    // ONLY for cheap local formats — never the slow PDF-vision transcribe.
    if (
      (kind === 'proposal' || kind === 'other') &&
      src &&
      (size ?? 0) < EXTRACT_SIZE_CAP &&
      classify(cleanName, contentType) !== 'pdf'
    ) {
      try {
        const [buf] = await src.download();
        const extracted = await extractText(buf, cleanName, contentType);
        if (extracted && extracted.trim() && extracted.trim() !== marker) {
          await docRef.update({ text: extracted, updatedAt: Date.now() });
        }
      } catch {
        // keep the marker text
      }
    }

    // Clean up the staging blob (ignore if already gone).
    if (src) {
      try {
        await src.delete();
      } catch {
        // already committed / removed — fine
      }
    }

    return { stagingId, ok: true, docId: docRef.id };
  } catch (e) {
    return { stagingId, ok: false, error: e instanceof Error ? e.message : 'commit failed' };
  }
}
