import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { anthropic } from './server';
import { modelFor } from './models';
import { refreshLeadUnderstanding, refreshLeadScan } from './leadRefresh';
import type { LeadNoteSession, WorkshopLead } from '@/lib/leads/types';

// ---------------------------------------------------------------------------
// Fireflies → Rhai ingestion. Pulls processed call transcripts from the
// Fireflies GraphQL API, matches each one to a workshopLeads doc, runs the
// Discovery Record extraction pass, and files the result as a note session on
// the lead (plus todos for every commitment Rhea made on the call).
//
// All types for this pipeline live here — lib/rhai/types.ts is owned by
// other agents.
// ---------------------------------------------------------------------------

const FIREFLIES_ENDPOINT = 'https://api.fireflies.ai/graphql';

/** Firestore collection tracking which transcripts have been processed. */
export const COL_FIREFLIES_INGESTED = 'firefliesIngested';
const COL_TODOS = 'rhaiTodos'; // {text, done, createdAt, updatedAt}

/** Rhea's own addresses — never used for lead matching. */
const OWN_EMAIL_PATTERNS = [/@rosebazaar\.in$/i, /fireflies/i];
const OWN_EMAILS = new Set(['rhea@rosebazaar.in']);

export interface FirefliesAttendee {
  displayName?: string | null;
  email?: string | null;
}

/** One row from the transcript list query. */
export interface FirefliesTranscriptSummary {
  id: string;
  title: string;
  /** ms since epoch (Fireflies returns a Float). */
  date: number;
  duration?: number | null;
  organizer_email?: string | null;
  participants?: (string | null)[] | null;
  meeting_attendees?: FirefliesAttendee[] | null;
}

export interface FirefliesSentence {
  speaker_name?: string | null;
  text?: string | null;
}

/** Full transcript detail — sentences + summary. */
export interface FirefliesTranscriptDetail extends FirefliesTranscriptSummary {
  sentences?: FirefliesSentence[] | null;
  summary?: {
    overview?: string | null;
    action_items?: string | null;
    keywords?: (string | null)[] | null;
  } | null;
}

/** Shape of a firefliesIngested/{transcriptId} doc. */
export interface FirefliesIngestRecord {
  status: 'ingested' | 'unmatched' | 'capture-gap' | 'internal';
  title: string;
  at: number;
  /** ms date of the call itself. */
  callDate?: number;
  leadId?: string;
  attendees?: string[];
}

// ---------------------------------------------------------------------------
// GraphQL client
// ---------------------------------------------------------------------------

async function firefliesQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) throw new Error('FIREFLIES_API_KEY not set');

  const res = await fetch(FIREFLIES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Fireflies API ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data?: T; errors?: Array<{ message?: string }> };
  if (json.errors?.length) {
    throw new Error(`Fireflies GraphQL error: ${json.errors.map(e => e.message).join('; ')}`);
  }
  if (!json.data) throw new Error('Fireflies GraphQL: empty response');
  return json.data;
}

const LIST_FIELDS = `
  id
  title
  date
  duration
  organizer_email
  participants
  meeting_attendees { displayName email }
`;

/** List transcripts from the last `days` days (newest first). */
export async function listRecentTranscripts(days: number): Promise<FirefliesTranscriptSummary[]> {
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const data = await firefliesQuery<{ transcripts: FirefliesTranscriptSummary[] | null }>(
    `query Recent($fromDate: DateTime, $limit: Int) {
       transcripts(fromDate: $fromDate, limit: $limit) { ${LIST_FIELDS} }
     }`,
    { fromDate, limit: 50 }
  );
  return data.transcripts ?? [];
}

/** Fetch one transcript with sentences + summary. */
export async function fetchTranscript(id: string): Promise<FirefliesTranscriptDetail | null> {
  const data = await firefliesQuery<{ transcript: FirefliesTranscriptDetail | null }>(
    `query One($id: String!) {
       transcript(id: $id) {
         ${LIST_FIELDS}
         sentences { speaker_name text }
         summary { overview action_items keywords }
       }
     }`,
    { id }
  );
  return data.transcript ?? null;
}

// ---------------------------------------------------------------------------
// Lead matching
// ---------------------------------------------------------------------------

function isOwnEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return OWN_EMAILS.has(e) || OWN_EMAIL_PATTERNS.some(p => p.test(e));
}

/** Attendee emails on the call that belong to the client side (not Rhea). */
export function clientEmails(t: FirefliesTranscriptSummary): string[] {
  const all = [
    ...(t.meeting_attendees ?? []).map(a => a?.email ?? ''),
    ...((t.participants ?? []).filter(Boolean) as string[]),
    t.organizer_email ?? ''
  ]
    .map(e => e.trim().toLowerCase())
    .filter(e => e.includes('@') && !isOwnEmail(e));
  return [...new Set(all)];
}

/** Meaningful lowercase tokens from a person/company string (len ≥ 3). */
function tokens(s: string | undefined): string[] {
  return (s ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !['the', 'and', 'ltd', 'llp', 'pvt', 'inc'].includes(t));
}

/**
 * Match a transcript to a lead:
 *  (a) exact — a client attendee email is listed in lead.contacts;
 *  (b) fuzzy — a lead.person / lead.company token appears in the transcript
 *      title or in a client attendee's email domain.
 * Exact wins over fuzzy; among fuzzy matches the most recently updated lead
 * wins (ties are rare and recency is the best prior).
 */
export function matchTranscriptToLead(
  t: FirefliesTranscriptSummary,
  leads: WorkshopLead[]
): WorkshopLead | null {
  const emails = clientEmails(t);
  const title = (t.title ?? '').toLowerCase();
  const domains = emails.map(e => e.split('@')[1] ?? '');

  // (a) exact contact-email match
  for (const lead of leads) {
    const contacts = (lead.contacts ?? []).map(c => c.trim().toLowerCase());
    if (contacts.some(c => emails.includes(c))) return lead;
  }

  // (b) fuzzy token match
  const fuzzy = leads.filter(lead => {
    const toks = [...tokens(lead.person), ...tokens(lead.company)];
    return toks.some(tok => title.includes(tok) || domains.some(d => d.includes(tok)));
  });
  if (fuzzy.length === 0) return null;
  return fuzzy.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
}

export interface LeadSuggestion {
  leadId: string;
  company?: string;
  person?: string;
  score: number;
  reasons: string[];
}

/**
 * Ranked lead candidates for a transcript that didn't auto-match (or for
 * operator review). Wider net than matchTranscriptToLead: scores every signal
 * and returns the top few with human-readable reasons.
 */
export function suggestLeadsForTranscript(
  t: FirefliesTranscriptSummary,
  leads: WorkshopLead[],
  limit = 3
): LeadSuggestion[] {
  const emails = clientEmails(t);
  const title = (t.title ?? '').toLowerCase();
  const domains = emails.map(e => e.split('@')[1] ?? '').filter(Boolean);

  const scored: LeadSuggestion[] = [];
  for (const lead of leads) {
    const reasons: string[] = [];
    let score = 0;

    const contacts = (lead.contacts ?? []).map(c => c.trim().toLowerCase());
    const emailHit = emails.find(e => contacts.includes(e));
    if (emailHit) {
      score += 10;
      reasons.push(`attendee ${emailHit} is a saved contact`);
    }

    for (const tok of [...tokens(lead.person), ...tokens(lead.company)]) {
      if (title.includes(tok)) {
        score += 3;
        reasons.push(`call title mentions “${tok}”`);
      }
      const d = domains.find(dom => dom.includes(tok));
      if (d) {
        score += 2;
        reasons.push(`attendee domain ${d} matches “${tok}”`);
      }
    }

    if (score > 0) {
      scored.push({
        leadId: lead.id,
        company: lead.company,
        person: lead.person,
        score,
        reasons: [...new Set(reasons)].slice(0, 3)
      });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Load all leads once for a matching pass. */
export async function loadAllLeads(): Promise<WorkshopLead[]> {
  const snap = await adminDb().collection('workshopLeads').get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<WorkshopLead, 'id'>) }));
}

// ---------------------------------------------------------------------------
// Extraction pass — the Discovery Record
// ---------------------------------------------------------------------------

const EXTRACTION_SYSTEM = `
You turn a raw discovery-call transcript into a "Discovery Record" — the structured field notes Rhea Karuturi (AI consultant, runs one-day AI build workshops inside companies) uses to research, scope, and win the engagement. Rhea is the seller on the call; everyone else is the client side.

Produce a markdown document with EXACTLY these sections, in this order:

## Facts
Entity (legal/trading name), stack (systems/tools they run), org (structure, headcount, key people), volumes (scale figures), economics (revenue, margins, pricing — whatever was said).

## Personas × daily problems
One line per person/role on the client side: "<name/role> — <their one daily problem>".

## Seed terms
Verbatim industry terms the client dropped. Each is a research thread. A dropped industry term is a SEED, never noise — capture every one, exactly as said, with a half-line on the context it came up in.

## Data-quality issues
Precise counts and lags mentioned or implied (e.g. "stock count off by ~200 units", "reports land 3 days late"). Numbers, not vibes.

## MY commitments
Everything Rhea promised on the call, each with a date (the date she promised delivery by, or "no date given"). Log EVERY promise.

## THEIR anxieties
Verbatim quotes of client worries, fears, hesitations. Quote them exactly — do not paraphrase.

## Quotable lines
Verbatim client lines that are proposal ammunition (pain admissions, ambition statements, budget signals).

## Deal mechanics
- Budget: …
- Approver: …
- Timeline: …
- Missing stakeholders (not yet spoken to): …

RULES:
- Capture anxieties verbatim; never paraphrase a quote.
- NEVER end without the entity name, the approver, the timeline, and the missing-stakeholder list. If any of these did not come up, write UNKNOWN explicitly.
- Be dense and factual. No filler, no advice.

After the markdown document, output ONE fenced JSON block:
\`\`\`json
{"todos": ["<short todo string per commitment Rhea made, with its date>", ...]}
\`\`\`
Each todo is a short imperative string (e.g. "Send Acme the proposal by Fri Jul 26"). Empty array if she made no commitments.
`.trim();

const MAX_TRANSCRIPT_FOR_MODEL = 120_000; // chars fed to the extractor
const MAX_NOTE_CHARS = 150_000; // cap on the stored note session

/** Speaker-labelled plain text of the call. */
export function transcriptText(t: FirefliesTranscriptDetail): string {
  return (t.sentences ?? [])
    .filter(s => (s?.text ?? '').trim())
    .map(s => `${s.speaker_name?.trim() || 'Unknown'}: ${s.text!.trim()}`)
    .join('\n');
}

export interface DiscoveryExtraction {
  record: string;
  todos: string[];
}

/** Run the extraction pass over a transcript's full text. */
export async function extractDiscoveryRecord(
  t: FirefliesTranscriptDetail,
  fullText: string
): Promise<DiscoveryExtraction> {
  const summaryBits = [
    t.summary?.overview ? `Fireflies overview: ${t.summary.overview}` : '',
    t.summary?.action_items ? `Fireflies action items: ${t.summary.action_items}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  const msg = await anthropic().messages.create({
    model: modelFor('suggest'),
    max_tokens: 4000,
    system: EXTRACTION_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          `Call: "${t.title}" on ${new Date(t.date).toDateString()}.`,
          `Attendees: ${(t.meeting_attendees ?? [])
            .map(a => [a?.displayName, a?.email].filter(Boolean).join(' '))
            .filter(Boolean)
            .join(', ') || 'unknown'}.`,
          summaryBits,
          '',
          'TRANSCRIPT:',
          fullText.slice(0, MAX_TRANSCRIPT_FOR_MODEL)
        ]
          .filter(Boolean)
          .join('\n')
      }
    ]
  });

  const raw = msg.content
    .flatMap(b => (b.type === 'text' ? [b.text] : []))
    .join('\n')
    .trim();

  // Peel the trailing ```json {"todos": [...]} ``` block off the record.
  let record = raw;
  let todos: string[] = [];
  const fence = /```(?:json)?\s*(\{[\s\S]*?\})\s*```\s*$/.exec(raw);
  if (fence) {
    try {
      const parsed = JSON.parse(fence[1]) as { todos?: unknown[] };
      todos = (parsed.todos ?? []).map(x => String(x).trim()).filter(Boolean);
      record = raw.slice(0, fence.index).trim();
    } catch {
      // keep record as-is; no todos parsed
    }
  }
  return { record, todos };
}

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------

export interface IngestResult {
  leadId: string;
  noteSessionId: string;
  todosAdded: number;
  label: string;
}

/**
 * File a transcript into a lead: extraction pass → noteSessions doc →
 * commitments into rhaiTodos → firefliesIngested marker → refresh the lead's
 * understanding + scan. The understanding/scan refresh is best-effort — a
 * model hiccup there must not lose the ingested note.
 */
export async function ingestTranscript(
  t: FirefliesTranscriptDetail,
  leadId: string
): Promise<IngestResult> {
  const db = adminDb();
  const leadRef = db.collection('workshopLeads').doc(leadId);
  if (!(await leadRef.get()).exists) throw new Error(`lead ${leadId} not found`);

  const fullText = transcriptText(t);
  if (!fullText.trim()) throw new Error(`transcript ${t.id} has no sentences`);

  const { record, todos } = await extractDiscoveryRecord(t, fullText);

  const dateLabel = new Date(t.date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const label = `Fireflies — ${t.title} (${dateLabel})`;

  const head = `${record}\n\n---\n## Full transcript\n`;
  const text = (head + fullText).slice(0, MAX_NOTE_CHARS);

  const session: Omit<LeadNoteSession, 'id'> = {
    text,
    source: 'transcribed',
    label,
    at: Date.now()
  };
  const noteRef = await leadRef.collection('noteSessions').add(session);
  await leadRef.update({ updatedAt: Date.now() });

  const now = Date.now();
  await Promise.all(
    todos.map(todo =>
      db
        .collection(COL_TODOS)
        .add({ text: todo.slice(0, 500), done: false, createdAt: now, updatedAt: now })
    )
  );

  const marker: FirefliesIngestRecord = {
    status: 'ingested',
    title: t.title ?? '',
    at: now,
    callDate: t.date,
    leadId,
    attendees: clientEmails(t)
  };
  await db.collection(COL_FIREFLIES_INGESTED).doc(t.id).set(marker);

  // Best-effort: rebuild Rhai's read on the client with the new material.
  try {
    await refreshLeadUnderstanding(leadId);
    await refreshLeadScan(leadId);
  } catch (e) {
    console.error(`fireflies: understanding/scan refresh failed for lead ${leadId}:`, e);
  }

  return { leadId, noteSessionId: noteRef.id, todosAdded: todos.length, label };
}

/** Add a to-do to rhaiTodos (used by the cron for alarms/unmatched calls). */
export async function addRhaiTodo(text: string): Promise<void> {
  const now = Date.now();
  await adminDb()
    .collection(COL_TODOS)
    .add({ text: text.slice(0, 500), done: false, createdAt: now, updatedAt: now });
}
