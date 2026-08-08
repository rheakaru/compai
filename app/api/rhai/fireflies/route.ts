import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import {
  COL_FIREFLIES_INGESTED,
  clientEmails,
  fetchTranscript,
  ingestTranscript,
  listRecentTranscripts,
  loadAllLeads,
  suggestLeadsForTranscript,
  type FirefliesIngestRecord,
  type LeadSuggestion
} from '@/lib/rhai/fireflies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Operator view of the Fireflies pipeline.
// GET  → ingest records (unmatched first) + the raw recent-call list, so a UI
//        can show what came in and what still needs assigning.
// POST → {transcriptId, leadId}: manually assign an unmatched (or missed)
//        transcript to a lead — ingests it and teaches the lead the client's
//        attendee emails so future calls auto-match.

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const snap = await adminDb()
    .collection(COL_FIREFLIES_INGESTED)
    .orderBy('at', 'desc')
    .limit(100)
    .get();
  const records = snap.docs.map(d => ({
    transcriptId: d.id,
    ...(d.data() as FirefliesIngestRecord)
  }));

  // Fresh list from Fireflies is best-effort — the stored records must still
  // render if the API key is missing or the API is down.
  const leads = await loadAllLeads();

  let recent: Array<{
    id: string;
    title: string;
    date: number;
    attendees: string[];
    status: FirefliesIngestRecord['status'] | 'new';
    leadId?: string;
    suggestions?: LeadSuggestion[];
  }> = [];
  let firefliesError: string | undefined;
  try {
    const byId = new Map(records.map(r => [r.transcriptId, r]));
    recent = (await listRecentTranscripts(14)).map(t => {
      const rec = byId.get(t.id);
      const status = rec?.status ?? 'new';
      const needsLink = status === 'new' || status === 'unmatched';
      return {
        id: t.id,
        title: t.title ?? '',
        date: t.date,
        attendees: clientEmails(t),
        status,
        ...(rec?.leadId ? { leadId: rec.leadId } : {}),
        ...(needsLink ? { suggestions: suggestLeadsForTranscript(t, leads) } : {})
      };
    });
  } catch (e) {
    firefliesError = e instanceof Error ? e.message : 'Fireflies list failed';
  }

  // Light lead list for the manual-assign picker.
  const leadOptions = leads
    .map(l => ({ id: l.id, company: l.company ?? '', person: l.person ?? '' }))
    .sort((a, b) => (a.company || a.person).localeCompare(b.company || b.person));

  return Response.json({
    records,
    recent,
    leadOptions,
    ...(firefliesError ? { firefliesError } : {})
  });
}

export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as { transcriptId?: string; leadId?: string };
  const transcriptId = body.transcriptId?.trim();
  const leadId = body.leadId?.trim();
  if (!transcriptId || !leadId) {
    return new Response('expected { transcriptId, leadId }', { status: 400 });
  }

  const leadRef = adminDb().collection('workshopLeads').doc(leadId);
  if (!(await leadRef.get()).exists) return new Response('lead not found', { status: 404 });

  let detail;
  try {
    detail = await fetchTranscript(transcriptId);
  } catch (e) {
    return Response.json(
      { error: `Fireflies fetch failed: ${e instanceof Error ? e.message : 'unknown'}` },
      { status: 502 }
    );
  }
  if (!detail) return new Response('transcript not found', { status: 404 });

  let result;
  try {
    result = await ingestTranscript(detail, leadId);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'ingest failed' },
      { status: 502 }
    );
  }

  // Teach the lead its client-side emails so future calls auto-match.
  const emails = clientEmails(detail);
  if (emails.length) {
    await leadRef.update({
      contacts: FieldValue.arrayUnion(...emails),
      updatedAt: Date.now()
    });
  }

  return Response.json({ ok: true, ...result, contactsAdded: emails });
}
