import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { anthropic } from '@/lib/rhai/server';
import { modelFor } from '@/lib/rhai/models';
import { buildLeadContext } from '@/lib/rhai/leadContext';
import { listEventsServer, type ServerCalEvent } from '@/lib/rhai/gcal-server';
import { sendWhatsAppText } from '@/lib/rhai/whatsapp';
import { normalizeLead, type WorkshopLead } from '@/lib/leads/types';

// Pre-call briefings — hit by a scheduler every ~15 minutes with
// `x-cron-secret`. Finds calendar events starting ~1h out, matches them to
// pipeline leads, and WhatsApps Rhea a briefing: what previous calls covered,
// open commitments, and the questions she must not forget.
//
// WhatsApp constraint (honest note): Meta's Cloud API only allows FREE-FORM
// messages inside the 24h customer-service window — i.e. only if Rhea has
// messaged Rhai within the last 24h. Outside that window the send is silently
// dropped by Meta. The production fix is a pre-approved template message
// (e.g. "briefing_ping") sent via the template API; until then we attempt the
// free-form send regardless AND persist the briefing to rhaiTodos so it is
// never lost.

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const COL_LEADS = 'workshopLeads';
const COL_BRIEFED = 'rhaiBriefedEvents';
const COL_SESSIONS = 'rhaiWhatsappSessions';
const COL_TODOS = 'rhaiTodos';

// Emails that count as "internal" when deciding whether an event has real
// external attendees. ALL of @rosebazaar.in is internal — Hoovu's own ops
// meetings (ops excellence Mon/Tue, sales farm + HR reviews Wed, pricing Fri…)
// are attended entirely by rosebazaar addresses and must never be briefed.
// Client calls have at least one external email (yeshoda@ may also be on
// them, which is fine — she doesn't make a call internal by herself).
const OWN_EMAILS = new Set(['rhea@rosebazaar.in']);
const INTERNAL_DOMAIN = /@rosebazaar\.in$/i;
const isInternalEmail = (e: string) => OWN_EMAILS.has(e.toLowerCase()) || INTERNAL_DOMAIN.test(e);

// Hoovu internal ops meetings recur with recognizable names and are NEVER Rhai
// client calls — but the attendee/lead heuristics above miss them: an outside
// accountant on the cashflow call gives them an "external" attendee, and a
// food/agri lead named e.g. "…Farm…"/"…Fresh…" falsely token-matches titles
// like "Farm Ops Review". So we skip these by title outright, whatever the
// attendees or lead match say. Add new recurring internal-meeting names here.
const INTERNAL_TITLE_PATTERNS: RegExp[] = [
  /operational excellence/i,
  /all cities/i,
  /cash\s*flow/i,
  /farm ops/i,
  /\bsales update\b/i,
  /\bhr\b.*(check|review|update|sync)/i,
  /customer service meeting/i,
  /\bpricing\b.*(meeting|review|call)/i,
  /\ball hands\b/i,
  /\bstandup\b|\bstand-up\b|\bstand up\b/i
];
const isInternalMeeting = (title: string) => INTERNAL_TITLE_PATTERNS.some(re => re.test(title || ''));

const WINDOW_MIN_MINS = 55;
const WINDOW_MAX_MINS = 80;

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3);
}

/** Defensive read of the (possibly not-yet-shipped) contacts field. */
function leadContacts(lead: WorkshopLead): string[] {
  const c = (lead as { contacts?: string[] }).contacts;
  return Array.isArray(c) ? c.map(x => String(x).toLowerCase()) : [];
}

function matchLead(event: ServerCalEvent, leads: WorkshopLead[]): WorkshopLead | null {
  const attendeeEmails = event.attendees.map(a => a.email.toLowerCase());
  const attendeeDomains = attendeeEmails.map(e => e.split('@')[1] ?? '').filter(Boolean);
  const summaryTokens = new Set(tokens(event.summary));

  for (const lead of leads) {
    // Strongest signal: an attendee email is on the lead's contact list.
    const contacts = leadContacts(lead);
    if (contacts.length && attendeeEmails.some(e => contacts.includes(e))) return lead;
  }
  for (const lead of leads) {
    // Fallback: person/company name token in the event title, or company token
    // in an attendee's email domain.
    const nameTokens = [...tokens(lead.person ?? ''), ...tokens(lead.company ?? '')];
    if (nameTokens.length === 0) continue;
    if (nameTokens.some(t => summaryTokens.has(t))) return lead;
    if (nameTokens.some(t => attendeeDomains.some(d => d.includes(t)))) return lead;
  }
  return null;
}

async function generateBriefing(event: ServerCalEvent, lead: WorkshopLead | null): Promise<string> {
  const startLocal = new Date(event.start).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const eventLine = [
    `Event: ${event.summary} at ${startLocal} IST`,
    event.attendees.length
      ? `Attendees: ${event.attendees.map(a => (a.displayName ? `${a.displayName} <${a.email}>` : a.email)).join(', ')}`
      : 'Attendees: (none listed — likely a phone call)',
    event.hangoutLink ? `Meet: ${event.hangoutLink}` : event.location ? `Location: ${event.location}` : null
  ]
    .filter(Boolean)
    .join('\n');

  let context = '';
  if (lead) {
    const built = await buildLeadContext(lead.id);
    context = built?.context ?? '';
  }

  const system = lead
    ? `You write Rhea's pre-call WhatsApp briefing, sent ~1 hour before a client call. Plain text only (no markdown headers, no asterisks-bold), skimmable short lines, under 3000 characters total. Structure:
1) One line: who the call is with and where the deal stands.
2) "Last time:" 3-6 tight bullets — the important points from previous calls/notes.
3) "You owe them:" open commitments Rhea has made (drafts, intros, docs). If none, say so in one line.
4) "Don't forget to ask:" — explicitly flag whichever of these are STILL UNKNOWN from the notes: entity legal name, tech stack, budget/approver/timeline, and who's missing from the room (stakeholder list). These four are her mandatory quadrant — call out gaps by name.
5) 2-3 pertinent questions for where the deal is right now.
Use "- " bullets. No preamble, no sign-off.`
    : `You write Rhea's pre-call WhatsApp briefing, sent ~1 hour before a call. Rhai has NO notes on these people — say that plainly in the first line. From the event title and attendee email domains alone, give: one line on who they appear to be, 2-3 sensible discovery questions, and a reminder of her mandatory quadrant (entity legal name, tech stack, budget/approver/timeline, missing stakeholders). Plain text, "- " bullets, under 1200 characters, no preamble.`;

  const msg = await anthropic().messages.create({
    model: modelFor('suggest'),
    max_tokens: 1200,
    system,
    messages: [
      {
        role: 'user',
        content: `${eventLine}${context ? `\n\nEVERYTHING RHAI KNOWS ABOUT THIS CLIENT:\n${context.slice(0, 60_000)}` : ''}`
      }
    ]
  });
  const text = msg.content
    .filter((b): b is Extract<(typeof msg.content)[number], { type: 'text' }> => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();
  const header = `Call in ~1h: ${event.summary} (${startLocal} IST)\n\n`;
  return (header + text).slice(0, 3500);
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  const to =
    process.env.WHATSAPP_BRIEFING_TO?.trim() ||
    (process.env.WHATSAPP_ALLOWED_NUMBERS ?? '').split(',')[0]?.trim();
  if (!to) return NextResponse.json({ error: 'no briefing recipient configured', briefed: [], skipped: 0 });

  const db = adminDb();
  const now = Date.now();

  let events: ServerCalEvent[];
  try {
    events = await listEventsServer(new Date(now), new Date(now + 26 * 3600_000));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'calendar unavailable', briefed: [], skipped: 0 },
      { status: 200 }
    );
  }

  const leadsSnap = await db.collection(COL_LEADS).get();
  const leads = leadsSnap.docs.map(d =>
    normalizeLead({ id: d.id, ...(d.data() as Omit<WorkshopLead, 'id'>) } as WorkshopLead & { type: string })
  );

  const briefed: Array<{ eventId: string; summary: string; leadId: string | null; delivered: string }> = [];
  let skipped = 0;

  for (const event of events) {
    if (event.allDay) {
      skipped++;
      continue;
    }
    const startMs = Date.parse(event.start);
    const minsAway = (startMs - now) / 60_000;
    // 55-80 min window: a 15-min cron always lands at least one tick inside it;
    // the dedupe doc below makes the overlap harmless.
    if (!Number.isFinite(minsAway) || minsAway < WINDOW_MIN_MINS || minsAway > WINDOW_MAX_MINS) {
      skipped++;
      continue;
    }

    // Hoovu internal ops meetings — never briefed, regardless of attendees or
    // any accidental lead token-match.
    if (isInternalMeeting(event.summary)) {
      skipped++;
      continue;
    }

    const lead = matchLead(event, leads);
    const externalAttendees = event.attendees.filter(a => !isInternalEmail(a.email));
    // All-internal events (Hoovu ops meetings) and solo blocks are not client
    // calls — unless the title names a lead (phone-only calls often have no
    // external attendees).
    if (externalAttendees.length === 0 && !lead) {
      skipped++;
      continue;
    }

    // Dedupe: create() fails if the doc exists, so overlapping cron windows
    // can't double-brief.
    try {
      await db.collection(COL_BRIEFED).doc(event.id).create({
        summary: event.summary,
        start: event.start,
        leadId: lead?.id ?? null,
        at: now
      });
    } catch {
      skipped++;
      continue;
    }

    let briefing: string;
    try {
      briefing = await generateBriefing(event, lead);
    } catch (e) {
      briefing = `Call in ~1h: ${event.summary}\n(Briefing generation failed: ${e instanceof Error ? e.message : 'unknown'})`;
    }

    // 24h-window check: free-form WhatsApp only delivers if Rhea messaged
    // Rhai within the last 24h (tracked at rhaiWhatsappSessions/{from}).
    let inWindow = false;
    try {
      const sess = await db.collection(COL_SESSIONS).doc(to).get();
      const updatedAt = sess.data()?.updatedAt as number | undefined;
      inWindow = typeof updatedAt === 'number' && now - updatedAt < 24 * 3600_000;
    } catch {
      /* treat as out of window */
    }

    // Attempt the send either way — Meta rejects silently outside the window.
    await sendWhatsAppText(to, briefing);
    let delivered = inWindow ? 'whatsapp' : 'whatsapp-attempted';
    if (!inWindow) {
      // Fallback so the briefing is never lost. Production fix: a pre-approved
      // "briefing_ping" template message, which works outside the window.
      try {
        await db.collection(COL_TODOS).add({
          text: briefing.slice(0, 3500),
          done: false,
          createdAt: now,
          updatedAt: now
        });
        delivered = 'whatsapp-attempted+todo';
      } catch {
        /* ignore */
      }
    }

    briefed.push({ eventId: event.id, summary: event.summary, leadId: lead?.id ?? null, delivered });
  }

  return NextResponse.json({ briefed, skipped });
}
