import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import {
  COL_FIREFLIES_INGESTED,
  addRhaiTodo,
  clientEmails,
  fetchTranscript,
  ingestTranscript,
  listRecentTranscripts,
  loadAllLeads,
  matchTranscriptToLead,
  transcriptText,
  type FirefliesIngestRecord
} from '@/lib/rhai/fireflies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Daily Fireflies sync. Pulls transcripts from the last N days (default 4;
// pass {days: 30} in the body for a backfill), skips ones already processed,
// alarms on capture gaps (a call with zero sentences = the recording never
// made it — voice-dump it before memory decays), ingests matched calls, and
// files unmatched ones as todos for manual assignment via /api/rhai/fireflies.
//
// Auth: either the x-cron-secret header (scheduler) or an operator bearer
// token (manual trigger from the dashboard).

const DEFAULT_DAYS = 4;
const MAX_DAYS = 90;

async function authorize(req: NextRequest): Promise<Response | null> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('x-cron-secret') === secret) return null;
  const { error } = await requireOperator(req);
  return error ?? null;
}

export async function POST(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;

  if (!process.env.FIREFLIES_API_KEY) {
    return Response.json({ error: 'FIREFLIES_API_KEY not set' }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { days?: number };
  const days = Math.min(MAX_DAYS, Math.max(1, Math.round(body.days ?? DEFAULT_DAYS)));

  const db = adminDb();
  const ingested: Array<{ transcriptId: string; leadId: string; label: string; todosAdded: number }> = [];
  const unmatched: Array<{ transcriptId: string; title: string; attendees: string[] }> = [];
  const captureGaps: Array<{ transcriptId: string; title: string }> = [];
  const errors: Array<{ transcriptId: string; error: string }> = [];
  let skipped = 0;
  let internalSkipped = 0;

  let transcripts;
  try {
    transcripts = await listRecentTranscripts(days);
  } catch (e) {
    return Response.json(
      { error: `Fireflies list failed: ${e instanceof Error ? e.message : 'unknown'}` },
      { status: 502 }
    );
  }

  const leads = await loadAllLeads();

  for (const summary of transcripts) {
    const markerRef = db.collection(COL_FIREFLIES_INGESTED).doc(summary.id);
    const marker = (await markerRef.get()).data() as FirefliesIngestRecord | undefined;
    // Already handled — except capture gaps, which we re-check in case the
    // transcript finished processing late.
    if (marker && marker.status !== 'capture-gap') {
      skipped++;
      continue;
    }

    try {
      const detail = await fetchTranscript(summary.id);
      if (!detail) {
        skipped++;
        continue;
      }

      const dateLabel = new Date(detail.date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      // Internal Hoovu/RoseBazaar meetings (ops excellence, sales farm, HR
      // reviews, pricing…) have ONLY @rosebazaar.in attendees. Client calls
      // always have at least one external email — or, when a client joins by
      // phone (no email attributed), a title that matches a pipeline lead.
      // Internal meetings are skipped silently: no ingestion, no unmatched
      // todo, no capture-gap alarm.
      const matchedLead = matchTranscriptToLead(detail, leads);
      if (!matchedLead && clientEmails(detail).length === 0) {
        const rec: FirefliesIngestRecord = {
          status: 'internal',
          title: detail.title ?? '',
          at: Date.now(),
          callDate: detail.date,
          attendees: []
        };
        await markerRef.set(rec);
        internalSkipped++;
        continue;
      }

      if (!transcriptText(detail).trim()) {
        // Capture gap — alarm exactly once.
        if (!marker) {
          await addRhaiTodo(
            `⚠️ Fireflies call '${detail.title}' (${dateLabel}) has NO transcript — voice-dump the call now before it decays`
          );
          const rec: FirefliesIngestRecord = {
            status: 'capture-gap',
            title: detail.title ?? '',
            at: Date.now(),
            callDate: detail.date,
            attendees: clientEmails(detail)
          };
          await markerRef.set(rec);
          captureGaps.push({ transcriptId: detail.id, title: detail.title ?? '' });
        } else {
          skipped++; // still empty; already alarmed
        }
        continue;
      }

      const lead = matchedLead;
      if (lead) {
        const result = await ingestTranscript(detail, lead.id);
        ingested.push({
          transcriptId: detail.id,
          leadId: lead.id,
          label: result.label,
          todosAdded: result.todosAdded
        });
      } else {
        const attendees = clientEmails(detail);
        await addRhaiTodo(
          `Unmatched Fireflies call '${detail.title}' (${dateLabel}, attendees: ${
            attendees.join(', ') || 'unknown'
          }) — assign it to a lead`
        );
        const rec: FirefliesIngestRecord = {
          status: 'unmatched',
          title: detail.title ?? '',
          at: Date.now(),
          callDate: detail.date,
          attendees
        };
        await markerRef.set(rec);
        unmatched.push({ transcriptId: detail.id, title: detail.title ?? '', attendees });
      }
    } catch (e) {
      errors.push({
        transcriptId: summary.id,
        error: e instanceof Error ? e.message : 'unknown error'
      });
    }
  }

  return Response.json({ days, ingested, unmatched, captureGaps, skipped, internalSkipped, errors });
}
