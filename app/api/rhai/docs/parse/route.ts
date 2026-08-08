import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { adminBucket } from '@/lib/firebase/admin';
import { requireFinance } from '@/lib/rhai/server';
import { loadAllLeads } from '@/lib/rhai/fireflies';
import { parseOne, leadLabel } from '@/lib/rhai/ndaParse';
import type { TrackedDocKind } from '@/lib/rhai/docTracking';

// Batch parse-and-stage. Each file is written to docStaging/{stagingId}/… and
// read with parseOne (filename fast-path, ONE Haiku call at most) so Rhea gets
// a review table instantly instead of two slow vision calls per upload. NO
// LeadDocument is created here — that happens on /commit after she confirms.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_BYTES = 25 * 1024 * 1024; // 25MB per file
const MAX_FILES = 15;

/** Storage-safe object name (the original name is kept on the LeadDocument). */
function sanitize(name: string): string {
  return (
    name
      .slice(0, 200)
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'file'
  );
}

/** Default doc kind from the filename — the model hint + the UI's pre-select. */
function defaultKind(name: string): TrackedDocKind {
  const low = name.toLowerCase();
  if (low.includes('signed')) return 'nda-signed';
  if (low.startsWith('nda_') || /(^|[^a-z])nda([^a-z]|$)/.test(low)) return 'nda';
  if (low.includes('proposal')) return 'proposal';
  return 'other';
}

export async function POST(req: NextRequest) {
  const { error } = await requireFinance(req);
  if (error) return error;

  const form = await req.formData().catch(() => null);
  if (!form) return new Response('expected a multipart form', { status: 400 });
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return new Response('no files uploaded', { status: 400 });
  if (files.length > MAX_FILES) return new Response(`too many files (max ${MAX_FILES})`, { status: 400 });
  for (const f of files) {
    if (f.size > MAX_BYTES) return new Response(`"${f.name}" is too large (max 25MB)`, { status: 413 });
  }

  const leads = await loadAllLeads();
  const leadOptions = leads.map(l => ({ id: l.id, label: leadLabel(l) }));

  const parsed = await Promise.all(
    files.map(async file => {
      const stagingId = randomUUID();
      const name = file.name.slice(0, 200);
      const mime = file.type || 'application/octet-stream';
      const buffer = Buffer.from(await file.arrayBuffer());

      // Stage the bytes. Best-effort — if staging fails, commit just files the
      // LeadDocument without a stored original (same as the single-upload path).
      try {
        await adminBucket()
          .file(`docStaging/${stagingId}/${sanitize(name)}`)
          .save(buffer, { contentType: mime, resumable: false });
      } catch {
        // ignore — surfaced (if at all) as a missing original at commit time
      }

      const meta = await parseOne(buffer, name, mime, defaultKind(name), leads).catch(() => ({
        docDate: null,
        clientName: null,
        parties: undefined,
        suggestedLeadId: null,
        suggestedLeadLabel: null,
        confidence: null,
        usedModel: false
      }));

      return {
        stagingId,
        name,
        size: file.size,
        mime,
        docDate: meta.docDate,
        clientName: meta.clientName,
        parties: meta.parties ?? [],
        suggestedLeadId: meta.suggestedLeadId,
        suggestedLeadLabel: meta.suggestedLeadLabel,
        confidence: meta.confidence,
        usedModel: meta.usedModel
      };
    })
  );

  return Response.json({ files: parsed, leads: leadOptions });
}
