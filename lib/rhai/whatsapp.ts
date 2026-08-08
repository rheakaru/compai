import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase/admin';
import {
  COL_IDEAS,
  COL_SUGGESTIONS,
  buildRhaiSystemPrompt,
  describeLeads,
  loadContextSections,
  runRhaiWithContext,
  type RhaiToolDef
} from './server';
import { upsertPersonIntel } from './people';
import { insertEventServer } from './gcal-server';
import { modelFor } from './models';
import { normalizeLead, type WorkshopLead } from '@/lib/leads/types';
import { SUGGESTION_KIND_LABELS, type SuggestionKind } from './types';

// Rhai over WhatsApp — Meta Cloud API. This module holds the provider I/O
// (send, media transcription, signature + sender checks) and the agent runner
// that turns an inbound message into a reply, reusing the exact same brain +
// tools as the in-app chat, plus quick todo/idea capture.

const GRAPH = 'https://graph.facebook.com/v21.0';
const COL_SESSIONS = 'rhaiWhatsappSessions';
const COL_TODOS = 'rhaiTodos';

// ---- provider I/O -----------------------------------------------------------

export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return;
  await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: body.slice(0, 4096), preview_url: false }
    })
  }).catch(() => undefined);
}

/** Send a document (e.g. a generated NDA PDF) by link — Meta fetches the URL,
 * so it must be publicly reachable for ~a minute (a signed Storage URL works). */
export async function sendWhatsAppDocument(
  to: string,
  link: string,
  filename: string,
  caption?: string
): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return;
  await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: { link, filename, ...(caption ? { caption: caption.slice(0, 1024) } : {}) }
    })
  }).catch(() => undefined);
}

/** Verify Meta's X-Hub-Signature-256. Skips (allows) if no app secret is set. */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;
  if (!header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(header.slice(7));
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Only Rhea's number(s) may talk to Rhai. Default-closed: if
 * WHATSAPP_ALLOWED_NUMBERS is unset, nobody is served. Compares on digits and
 * tolerates country-code prefix differences.
 */
export function isAllowedSender(from: string): boolean {
  const raw = process.env.WHATSAPP_ALLOWED_NUMBERS;
  if (!raw) return false;
  const f = from.replace(/\D/g, '');
  return raw
    .split(',')
    .map(s => s.replace(/\D/g, ''))
    .filter(Boolean)
    .some(a => f === a || (a.length >= 10 && (f.endsWith(a) || a.endsWith(f))));
}

/** Download a WhatsApp voice note and transcribe it with ElevenLabs Scribe. */
export async function transcribeWhatsAppAudio(mediaId: string): Promise<string | null> {
  const token = process.env.WHATSAPP_TOKEN;
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (!mediaId || !token || !elevenKey) return null;
  try {
    const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers: { authorization: `Bearer ${token}` } });
    if (!metaRes.ok) return null;
    const { url } = (await metaRes.json()) as { url?: string };
    if (!url) return null;
    const audioRes = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!audioRes.ok) return null;
    const buf = Buffer.from(await audioRes.arrayBuffer());
    const form = new FormData();
    form.append('file', new Blob([buf], { type: 'audio/ogg' }), 'voice.ogg');
    form.append('model_id', 'scribe_v1');
    form.append('language_code', 'eng');
    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': elevenKey },
      body: form
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { text?: string };
    return (j.text ?? '').trim() || null;
  } catch {
    return null;
  }
}

/** Download any WhatsApp media item (image / document) as a buffer. */
export async function downloadWhatsAppMedia(
  mediaId: string
): Promise<{ buffer: Buffer; mime: string } | null> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!mediaId || !token) return null;
  try {
    const metaRes = await fetch(`${GRAPH}/${mediaId}`, {
      headers: { authorization: `Bearer ${token}` }
    });
    if (!metaRes.ok) return null;
    const { url, mime_type } = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!url) return null;
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      mime: mime_type || res.headers.get('content-type') || 'application/octet-stream'
    };
  } catch {
    return null;
  }
}

// ---- attachments: receipts + travel tickets ---------------------------------

interface AttachmentClassification {
  type: 'receipt' | 'travel-ticket' | 'other';
  receipt?: { vendor?: string; amount?: number; date?: string };
  ticket?: {
    carrier?: string;
    number?: string; // "6E 123"
    from?: string; // "BLR"
    to?: string;
    date?: string; // YYYY-MM-DD
    depTime?: string; // HH:MM 24h local
    arrTime?: string;
    pnr?: string;
    passenger?: string;
  };
}

/** One Claude pass: is this a receipt or a travel ticket, and what's on it? */
async function classifyAttachment(media: {
  buffer: Buffer;
  mime: string;
}): Promise<AttachmentClassification> {
  const isPdf = media.mime === 'application/pdf';
  if (!isPdf && !media.mime.startsWith('image/')) return { type: 'other' };
  const { anthropic, parseJsonLoose } = await import('./server');
  const { modelFor } = await import('./models');
  const source = {
    type: 'base64',
    media_type: isPdf ? 'application/pdf' : media.mime,
    data: media.buffer.toString('base64')
  };
  const prompt = [
    'Classify this document and extract its details. Return ONLY JSON, no prose:',
    '{',
    '  "type": "receipt" | "travel-ticket" | "other",',
    '  "receipt": { "vendor": "...", "amount": <number>, "date": "YYYY-MM-DD" },  // if receipt/invoice',
    '  "ticket": { "carrier": "IndiGo", "number": "6E 123", "from": "BLR", "to": "HYD",',
    '              "date": "YYYY-MM-DD", "depTime": "HH:MM", "arrTime": "HH:MM",',
    '              "pnr": "...", "passenger": "..." }  // if flight/train/bus ticket or booking confirmation',
    '}',
    'travel-ticket = a ticket or booking confirmation for a journey (flight, train, bus) or hotel.',
    'receipt = a bill, invoice, or payment receipt for something purchased.',
    'Omit fields you cannot read confidently. Times in 24h local time.'
  ].join('\n');
  try {
    const msg = await anthropic().messages.create({
      model: modelFor('transcribe'),
      max_tokens: 800,
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
    const parsed = parseJsonLoose<AttachmentClassification>(text);
    if (parsed && ['receipt', 'travel-ticket', 'other'].includes(parsed.type)) return parsed;
  } catch {
    /* fall through */
  }
  return { type: 'other' };
}

/**
 * Route a WhatsApp attachment: travel tickets → Google Calendar (if not
 * already there) + the travel tracker; everything else → the cost tracker.
 * Returns the confirmation text to send back.
 */
export async function handleWhatsAppAttachment(
  media: { buffer: Buffer; mime: string },
  caption?: string
): Promise<string> {
  const cls = await classifyAttachment(media);
  if (cls.type === 'travel-ticket' && cls.ticket?.date) {
    return handleTicket(cls.ticket, media, caption);
  }
  // Receipts and anything unrecognized fall through to the cost tracker,
  // reusing whatever the classifier already read.
  return logReceiptFromWhatsApp(media, caption, cls.receipt);
}

async function handleTicket(
  t: NonNullable<AttachmentClassification['ticket']>,
  media: { buffer: Buffer; mime: string },
  caption?: string
): Promise<string> {
  const db = adminDb();
  const label = [t.carrier, t.number].filter(Boolean).join(' ') || 'Travel';
  const route = t.from && t.to ? `${t.from} → ${t.to}` : '';
  const summary = `✈️ ${label}${route ? ` ${route}` : ''}`.trim();
  const date = t.date!;

  // Store the ticket file for reference.
  let stored = false;
  try {
    const { adminBucket } = await import('@/lib/firebase/admin');
    const ext = media.mime.includes('pdf') ? 'pdf' : media.mime.split('/')[1] || 'jpg';
    await adminBucket()
      .file(`travelDocuments/${date}-${(t.pnr || label).replace(/[^A-Za-z0-9]+/g, '_')}.${ext}`)
      .save(media.buffer, { contentType: media.mime, resumable: false });
    stored = true;
  } catch {
    /* best-effort */
  }

  // Already on the calendar? Look ±1 day for an event mentioning the flight
  // number or the same route emoji-summary.
  const lines: string[] = [];
  try {
    const { listEventsServer, insertEventServer } = await import('./gcal-server');
    const dayStart = new Date(`${date}T00:00:00+05:30`);
    const existing = await listEventsServer(
      new Date(dayStart.getTime() - 86_400_000),
      new Date(dayStart.getTime() + 2 * 86_400_000)
    );
    const numToken = (t.number ?? '').replace(/\s+/g, '').toLowerCase();
    const dup = existing.find(e => {
      const s = e.summary.replace(/\s+/g, '').toLowerCase();
      return (numToken && s.includes(numToken)) || (route && e.summary.includes(route));
    });
    if (dup) {
      lines.push(`Already on your calendar: "${dup.summary}" — didn't add it again.`);
    } else {
      const dep = t.depTime && /^\d{2}:\d{2}$/.test(t.depTime) ? t.depTime : '09:00';
      const arr =
        t.arrTime && /^\d{2}:\d{2}$/.test(t.arrTime) && t.arrTime > dep
          ? t.arrTime
          : `${pad2(Math.min(23, Number(dep.slice(0, 2)) + 2))}:${dep.slice(3)}`;
      const ev = await insertEventServer({
        summary,
        description: [
          t.pnr ? `PNR: ${t.pnr}` : null,
          t.passenger ? `Passenger: ${t.passenger}` : null,
          caption || null,
          'Added by Rhai from a WhatsApp ticket.'
        ]
          .filter(Boolean)
          .join('\n'),
        start: { dateTime: `${date}T${dep}:00`, timeZone: 'Asia/Kolkata' },
        end: { dateTime: `${date}T${arr}:00`, timeZone: 'Asia/Kolkata' }
      });
      lines.push(
        `Added to your calendar: ${summary} on ${date}${t.depTime ? ` at ${t.depTime}` : ''}. ${ev.htmlLink}`
      );
    }
  } catch (e) {
    lines.push(
      `Couldn't check/update the calendar (${e instanceof Error ? e.message : 'error'}) — add it manually.`
    );
  }

  // Mark a matching trip's flight as booked in the travel tracker.
  try {
    const trips = await db.collection('rhaiTravel').orderBy('updatedAt', 'desc').limit(30).get();
    const hit = trips.docs.find(d => {
      const trip = d.data() as { startDate?: string; endDate?: string; done?: boolean };
      if (trip.done) return false;
      const s = trip.startDate ?? '';
      const e = trip.endDate ?? s;
      return s && date >= addDays(s, -2) && date <= addDays(e || s, 2);
    });
    if (hit) {
      const trip = hit.data() as {
        client?: string;
        items?: Array<{ kind: string; status: string; detail?: string; confirmation?: string }>;
      };
      const items = trip.items ?? [];
      const idx = items.findIndex(i => i.kind === 'flight' && i.status !== 'booked');
      if (idx >= 0) {
        items[idx] = {
          ...items[idx],
          status: 'booked',
          ...(route ? { detail: `${route} ${date}` } : {}),
          ...(t.pnr ? { confirmation: t.pnr } : {})
        };
        await hit.ref.set({ items, updatedAt: Date.now() }, { merge: true });
        lines.push(`Marked the flight booked on the ${trip.client ?? ''} trip in Accounting → Travel.`);
      }
    }
  } catch {
    /* tracker update is best-effort */
  }

  if (t.pnr) lines.push(`PNR ${t.pnr}${stored ? ' — ticket saved' : ''}.`);
  return lines.join('\n');
}

const pad2 = (n: number) => String(n).padStart(2, '0');
function addDays(isoDate: string, days: number): string {
  const t = new Date(`${isoDate}T00:00:00Z`).getTime();
  return Number.isNaN(t) ? isoDate : new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * A receipt photo / PDF sent on WhatsApp → a cost in the accounting tracker.
 * Claude reads vendor/amount/date off it; the file is stored alongside.
 * Returns the confirmation text to send back.
 */
export async function logReceiptFromWhatsApp(
  media: { buffer: Buffer; mime: string },
  caption?: string,
  preExtracted?: { vendor?: string; amount?: number; date?: string }
): Promise<string> {
  let extracted: { client?: string; amount?: number; issueDate?: string } = preExtracted
    ? { client: preExtracted.vendor, amount: preExtracted.amount, issueDate: preExtracted.date }
    : {};
  if (!extracted.client && !extracted.amount) {
    try {
      const { extractInvoiceFields } = await import('./invoice-extract');
      extracted = await extractInvoiceFields(media.buffer, media.mime);
    } catch {
      /* best-effort */
    }
  }

  const { todayISO } = await import('./invoices');
  const now = Date.now();
  const db = adminDb();
  const ref = db.collection('rhaiCosts').doc();

  const ext = media.mime.includes('pdf') ? 'pdf' : media.mime.split('/')[1] || 'jpg';
  const fileName = `whatsapp-receipt-${new Date(now).toISOString().slice(0, 10)}-${ref.id.slice(0, 6)}.${ext}`;
  let storagePath: string | undefined = `costDocuments/${ref.id}/${fileName}`;
  try {
    const { adminBucket } = await import('@/lib/firebase/admin');
    await adminBucket().file(storagePath).save(media.buffer, {
      contentType: media.mime,
      resumable: false
    });
  } catch {
    storagePath = undefined;
  }

  const vendor = extracted.client || '';
  const amount = extracted.amount || 0;
  await ref.set({
    vendor,
    amount,
    date: extracted.issueDate || todayISO(now),
    category: 'other',
    ...(caption?.trim() ? { note: caption.trim().slice(0, 500) } : {}),
    fileName,
    ...(storagePath ? { storagePath } : {}),
    mime: media.mime,
    createdAt: now,
    updatedAt: now
  });

  if (vendor && amount) {
    return `Receipt logged: ₹${amount.toLocaleString('en-IN')} to ${vendor}${
      extracted.issueDate ? ` (${extracted.issueDate})` : ''
    }. It's in Accounting → Costs — reply if the category should be travel/software/filings.`;
  }
  return `Receipt saved to Accounting → Costs, but I couldn't read the ${
    !vendor && !amount ? 'vendor or amount' : !vendor ? 'vendor' : 'amount'
  } off it — open the dashboard to fill that in, or text me the details.`;
}

// ---- the brain --------------------------------------------------------------

interface StoredTurn {
  role: 'user' | 'rhai';
  text: string;
  at: number;
}

function whatsappAddendum(): string {
  // Today's date in Asia/Kolkata so relative dates ("tomorrow at 3") resolve
  // correctly regardless of the server's locale/timezone.
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  return `
You are talking to Rhea over WhatsApp — she's on her phone, capturing things on the move. Keep replies short and skimmable: a few lines, plain text, no markdown headers or long essays. Today is ${today} (Asia/Kolkata). This is a primary capture channel — route what she gives you, don't just chat:
- A task/reminder for herself → call add_todo.
- An idea → call add_idea (a one-line take is welcome, but capture it first).
- Something to draft/prep for a client, or any actionable that shouldn't be lost → call propose_action so it lands on Today.
- Intel about a person → call update_person.
- Use get_pipeline before answering pipeline questions.
- A scheduling request ("set up a call with X tomorrow at 3, invite a@b.com") → call schedule_meeting; resolve relative dates from today's date above, times are Asia/Kolkata. Include the event + Meet links from the tool result in your confirmation.
- A company legal name with an NDA ask ("NDA for Acme Widgets Private Limited") → call generate_nda; the PDF is sent to her chat by the tool. Relay the blanks she still has to fill and whether it was signature-stamped.
- An invoice ask ("invoice Kothari 1 lakh for the workshop") → call create_invoice; amounts she gives are the taxable value (GST is added on top automatically). The PDF is sent to her chat. If she doesn't give the client's GSTIN, generate anyway and remind her to add it if the client is registered.
- Travel for a client trip ("Dodla trip 14–15 Aug, they still owe me flights and hotel") → call log_travel. Client-booked travel: track what the client still has to book for her.
- A business expense / receipt amount ("paid 4,500 to Cleartax for filings") → call log_cost. (Receipt photos and ticket PDFs she sends are handled automatically before reaching you — receipts land in Costs, flight tickets go on her calendar.)
- You can brainstorm and sketch a proposal inline; the full proposal document gets built in the app, so offer to file it via propose_action.
- Briefly confirm what you saved. Warm, concrete, no filler.`;
}

export async function buildWhatsappReply(params: {
  from: string;
  name?: string;
  text: string;
}): Promise<string> {
  const db = adminDb();
  const sessRef = db.collection(COL_SESSIONS).doc(params.from);
  const snap = await sessRef.get();
  const stored = (snap.data()?.messages ?? []) as StoredTurn[];
  const prior: Anthropic.Messages.MessageParam[] = stored
    .filter(m => m.text?.trim())
    .slice(-20)
    .map(m => ({ role: m.role === 'rhai' ? ('assistant' as const) : ('user' as const), content: m.text }));

  const validKinds = new Set(Object.keys(SUGGESTION_KIND_LABELS));
  const clientTools: RhaiToolDef[] = [
    {
      schema: {
        name: 'add_todo',
        description: 'Capture a to-do Rhea wants to do herself. Use when she says to remember or do something actionable.',
        input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }
      },
      execute: async input => {
        const t = String((input as { text?: string }).text ?? '').trim();
        if (!t) return 'no text';
        const now = Date.now();
        await db.collection(COL_TODOS).add({ text: t.slice(0, 500), done: false, createdAt: now, updatedAt: now });
        return `Added to-do: ${t}`;
      }
    },
    {
      schema: {
        name: 'add_idea',
        description: 'Park an idea Rhea shares, so it lands on the Ideas board where Rhai can research/brainstorm it later.',
        input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }
      },
      execute: async input => {
        const t = String((input as { text?: string }).text ?? '').trim();
        if (!t) return 'no text';
        const now = Date.now();
        await db.collection(COL_IDEAS).add({ text: t.slice(0, 1000), status: 'parked', createdAt: now, updatedAt: now });
        return `Parked idea: ${t}`;
      }
    },
    {
      schema: {
        name: 'propose_action',
        description:
          'File a suggestion on the Today panel for Rhea to approve (draft an email, research something, start a proposal, prep a deck…).',
        input_schema: {
          type: 'object',
          properties: {
            kind: { type: 'string', description: 'follow_up | draft | research | prep | network | invoice' },
            title: { type: 'string' },
            detail: { type: 'string', description: 'Why + exactly what you’ll do if approved' },
            leadLabel: { type: 'string', description: 'Optional person/company this is about' }
          },
          required: ['kind', 'title', 'detail']
        }
      },
      execute: async input => {
        const i = input as { kind: string; title: string; detail: string; leadLabel?: string };
        const now = Date.now();
        await db.collection(COL_SUGGESTIONS).add({
          kind: (validKinds.has(i.kind) ? i.kind : 'follow_up') as SuggestionKind,
          title: i.title.slice(0, 200),
          detail: i.detail.slice(0, 2000),
          ...(i.leadLabel ? { leadLabel: i.leadLabel.slice(0, 120) } : {}),
          status: 'proposed' as const,
          createdAt: now,
          updatedAt: now
        });
        return `Filed on Today: ${i.title}`;
      }
    },
    {
      schema: {
        name: 'update_person',
        description: 'Save intel about a person to their profile (creates them if new). Use when Rhea shares context about someone.',
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            note: { type: 'string' },
            headline: { type: 'string' },
            company: { type: 'string' },
            city: { type: 'string' }
          },
          required: ['name', 'note']
        }
      },
      execute: async input => {
        const i = input as { name: string; note: string; headline?: string; company?: string; city?: string };
        const { person, created } = await upsertPersonIntel({
          name: i.name,
          note: i.note,
          source: 'chat',
          fields: {
            ...(i.headline ? { headline: i.headline } : {}),
            ...(i.company ? { company: i.company } : {}),
            ...(i.city ? { city: i.city } : {})
          }
        });
        return `${created ? 'Created profile' : 'Updated profile'}: ${person.name}`;
      }
    },
    {
      schema: {
        name: 'schedule_meeting',
        description:
          'Create a Google Calendar event on Rhea’s primary calendar, optionally inviting attendees by email (they get an invite + Google Meet link). Times are Asia/Kolkata.',
        input_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Event title' },
            date: { type: 'string', description: 'YYYY-MM-DD (Asia/Kolkata)' },
            time: { type: 'string', description: 'HH:mm, 24-hour, Asia/Kolkata' },
            durationMins: { type: 'number', description: 'Duration in minutes (default 45)' },
            attendeeEmails: { type: 'array', items: { type: 'string' }, description: 'Attendee emails to invite (optional)' },
            description: { type: 'string', description: 'Event description (optional)' },
            withMeet: {
              type: 'boolean',
              description: 'Attach a Google Meet link. Defaults to true when attendees are present.'
            }
          },
          required: ['title', 'date', 'time']
        }
      },
      execute: async input => {
        const i = input as {
          title?: string;
          date?: string;
          time?: string;
          durationMins?: number;
          attendeeEmails?: string[];
          description?: string;
          withMeet?: boolean;
        };
        const title = String(i.title ?? '').trim();
        const date = String(i.date ?? '').trim();
        const time = String(i.time ?? '').trim();
        if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
          return 'tool error: need title, date (YYYY-MM-DD) and time (HH:mm, 24h IST)';
        }
        const durationMins = Number.isFinite(i.durationMins) && (i.durationMins as number) > 0 ? Math.round(i.durationMins as number) : 45;
        const attendeeEmails = (i.attendeeEmails ?? []).map(e => String(e).trim()).filter(e => /.+@.+\..+/.test(e));
        const withMeet = i.withMeet ?? attendeeEmails.length > 0;

        // Build start/end wall-clock strings and let the Calendar API apply the
        // timezone — never trust the server's locale for IST math.
        const [h, m] = time.split(':').map(Number);
        const endTotal = h * 60 + m + durationMins;
        let endDate = date;
        let endMins = endTotal;
        if (endTotal >= 24 * 60) {
          // Rolls past midnight — bump the date (UTC math on the date string is safe).
          endMins = endTotal - 24 * 60;
          const dNext = new Date(`${date}T00:00:00Z`);
          dNext.setUTCDate(dNext.getUTCDate() + 1);
          endDate = dNext.toISOString().slice(0, 10);
        }
        const pad = (n: number) => String(n).padStart(2, '0');
        const tz = 'Asia/Kolkata';
        const ev = await insertEventServer({
          summary: title,
          ...(i.description ? { description: String(i.description).slice(0, 2000) } : {}),
          start: { dateTime: `${date}T${time}:00`, timeZone: tz },
          end: { dateTime: `${endDate}T${pad(Math.floor(endMins / 60))}:${pad(endMins % 60)}:00`, timeZone: tz },
          ...(attendeeEmails.length ? { attendeeEmails } : {}),
          withMeet
        });
        return [
          `Scheduled "${title}" on ${date} at ${time} IST (${durationMins} min).`,
          attendeeEmails.length ? `Invited: ${attendeeEmails.join(', ')}` : null,
          `Event: ${ev.htmlLink}`,
          ev.meetLink ? `Meet: ${ev.meetLink}` : null
        ]
          .filter(Boolean)
          .join('\n');
      }
    },
    {
      schema: {
        name: 'generate_nda',
        description:
          'Generate Rhea’s standard mutual NDA as a signed PDF and send it to her right here on WhatsApp. Use when she sends a company legal name and wants the NDA. Include "Private Limited"/"Limited" exactly as she gives it. Optionally pass leadLabel (person/company) to pull discovery context for the Purpose clause.',
        input_schema: {
          type: 'object',
          properties: {
            clientLegalName: { type: 'string', description: 'Client’s full legal name, verbatim' },
            leadLabel: { type: 'string', description: 'Optional person/company to link the NDA to a pipeline lead' }
          },
          required: ['clientLegalName']
        }
      },
      execute: async input => {
        const i = input as { clientLegalName?: string; leadLabel?: string };
        const clientLegalName = String(i.clientLegalName ?? '').trim();
        if (!clientLegalName) return 'tool error: clientLegalName required';

        // Resolve an optional lead by fuzzy person/company match so the NDA
        // lands on the right client and its Purpose clause uses discovery.
        let leadId: string | undefined;
        const label = String(i.leadLabel ?? clientLegalName).toLowerCase();
        try {
          const s = await db.collection('workshopLeads').orderBy('updatedAt', 'desc').limit(100).get();
          const hit = s.docs.find(d => {
            const l = d.data() as { person?: string; company?: string };
            return [l.person, l.company]
              .filter(Boolean)
              .some(v => label.includes(String(v).toLowerCase()) || String(v).toLowerCase().includes(label.split(' ')[0]));
          });
          leadId = hit?.id;
        } catch {
          /* lead link is best-effort */
        }

        const { generateAndStoreNda } = await import('./nda');
        const nda = await generateAndStoreNda({ clientLegalName, leadId });
        await sendWhatsAppDocument(
          params.from,
          nda.url,
          nda.filename,
          nda.signed ? 'Signed and dated — review the blanks before sending.' : 'Unsigned — no signature on file yet.'
        );
        return [
          `NDA generated and sent as a PDF: ${nda.filename}.`,
          nda.signed
            ? 'Stamped with her signature on every page + the signature block, dated today.'
            : 'NOT signature-stamped — she hasn’t uploaded a signature in the NDA tab yet.',
          nda.blanks.length ? `Blanks she must fill before sending: ${nda.blanks.join('; ')}.` : 'No blanks — ready to send.',
          leadId ? 'Filed on the matching lead’s documents.' : 'No matching pipeline lead found — not filed on a lead.'
        ].join('\n');
      }
    },
    {
      schema: {
        name: 'create_invoice',
        description:
          'Generate a GST tax invoice PDF under RHAI CONSULTING GROUP PRIVATE LIMITED and send it here on WhatsApp. Amounts are the taxable value in rupees — CGST/SGST or IGST is added automatically (from the client GSTIN state, else intra-state Karnataka). The invoice is saved as a draft in the dashboard Invoices tab.',
        input_schema: {
          type: 'object',
          properties: {
            client: { type: 'string', description: 'Client legal name, verbatim as it should appear on the invoice' },
            amount: { type: 'number', description: 'Taxable amount in rupees (before GST)' },
            description: {
              type: 'string',
              description:
                'Line item: first line a short bold title ("AI Workshop and Build Session"), then 1–3 sentences of concrete detail on following lines'
            },
            clientGstin: { type: 'string', description: 'Client GSTIN if she gives it' },
            clientAddress: { type: 'string', description: 'Client billing address if she gives it' }
          },
          required: ['client', 'amount', 'description']
        }
      },
      execute: async input => {
        const i = input as {
          client?: string;
          amount?: number;
          description?: string;
          clientGstin?: string;
          clientAddress?: string;
        };
        if (!i.client?.trim() || !i.amount || !i.description?.trim()) {
          return 'tool error: client, amount and description are required';
        }
        try {
          const { generateAndStoreInvoice } = await import('./invoice-pdf');
          const inv = await generateAndStoreInvoice({
            client: i.client.trim(),
            clientGstin: i.clientGstin,
            clientAddress: i.clientAddress,
            lineItems: [{ description: i.description.trim(), amount: i.amount }]
          });
          await sendWhatsAppDocument(
            params.from,
            inv.url,
            inv.filename,
            `${inv.invoiceNumber} — total ₹${inv.gst.total.toLocaleString('en-IN')} incl. GST.`
          );
          return [
            `Invoice ${inv.invoiceNumber} generated and sent as a PDF.`,
            `Taxable ₹${inv.gst.taxable.toLocaleString('en-IN')} + ${
              inv.gst.mode === 'igst'
                ? `IGST ₹${inv.gst.igst.toLocaleString('en-IN')}`
                : `CGST ₹${inv.gst.cgst.toLocaleString('en-IN')} + SGST ₹${inv.gst.sgst.toLocaleString('en-IN')}`
            } = ₹${inv.gst.total.toLocaleString('en-IN')}.`,
            'Saved as a draft in the Invoices tab — mark it sent from there.',
            ...inv.warnings
          ].join('\n');
        } catch (e) {
          return `tool error: ${e instanceof Error ? e.message : 'invoice generation failed'}`;
        }
      }
    },
    {
      schema: {
        name: 'log_travel',
        description:
          'Log or update a client trip in the travel tracker — client-booked travel/accommodation for an on-site engagement. Use when Rhea mentions an upcoming trip or what a client still needs to book for her.',
        input_schema: {
          type: 'object',
          properties: {
            client: { type: 'string' },
            city: { type: 'string' },
            startDate: { type: 'string', description: 'YYYY-MM-DD' },
            endDate: { type: 'string', description: 'YYYY-MM-DD' },
            purpose: { type: 'string', description: 'recce / workshop / build session' },
            items: {
              type: 'array',
              description: 'What the client must book: flight/hotel/cab/train with status needed|requested|booked',
              items: {
                type: 'object',
                properties: {
                  kind: { type: 'string', enum: ['flight', 'hotel', 'cab', 'train', 'other'] },
                  status: { type: 'string', enum: ['needed', 'requested', 'booked'] },
                  detail: { type: 'string' },
                  confirmation: { type: 'string', description: 'PNR / booking ref once booked' }
                },
                required: ['kind', 'status']
              }
            },
            note: { type: 'string' }
          },
          required: ['client']
        }
      },
      execute: async input => {
        const i = input as {
          client?: string;
          city?: string;
          startDate?: string;
          endDate?: string;
          purpose?: string;
          items?: Array<{ kind: string; status: string; detail?: string; confirmation?: string }>;
          note?: string;
        };
        if (!i.client?.trim()) return 'tool error: client required';
        const now = Date.now();
        await db.collection('rhaiTravel').add({
          client: i.client.trim(),
          ...(i.city ? { city: i.city } : {}),
          ...(i.startDate ? { startDate: i.startDate } : {}),
          ...(i.endDate ? { endDate: i.endDate } : {}),
          ...(i.purpose ? { purpose: i.purpose } : {}),
          items: (i.items ?? [{ kind: 'flight', status: 'needed' }, { kind: 'hotel', status: 'needed' }]).slice(0, 20),
          ...(i.note ? { note: i.note } : {}),
          createdAt: now,
          updatedAt: now
        });
        return `Trip logged for ${i.client} — it's in Accounting → Travel on the dashboard.`;
      }
    },
    {
      schema: {
        name: 'log_cost',
        description:
          'Record a business expense for the company (vendor, amount, category). Use when Rhea mentions paying for something — filings, software, travel she covered herself, professional fees.',
        input_schema: {
          type: 'object',
          properties: {
            vendor: { type: 'string' },
            amount: { type: 'number', description: 'Rupees' },
            category: {
              type: 'string',
              enum: ['travel', 'software', 'filings', 'professional-fees', 'office', 'other']
            },
            date: { type: 'string', description: 'YYYY-MM-DD; default today' },
            gstPaid: { type: 'number', description: 'GST component if she mentions it' },
            note: { type: 'string' }
          },
          required: ['vendor', 'amount']
        }
      },
      execute: async input => {
        const i = input as {
          vendor?: string;
          amount?: number;
          category?: string;
          date?: string;
          gstPaid?: number;
          note?: string;
        };
        if (!i.vendor?.trim() || !i.amount) return 'tool error: vendor and amount required';
        const now = Date.now();
        const { todayISO } = await import('./invoices');
        await db.collection('rhaiCosts').add({
          vendor: i.vendor.trim(),
          amount: i.amount,
          date: i.date ?? todayISO(now),
          category: i.category ?? 'other',
          ...(i.gstPaid ? { gstPaid: i.gstPaid } : {}),
          ...(i.note ? { note: i.note } : {}),
          createdAt: now,
          updatedAt: now
        });
        return `Logged ₹${i.amount.toLocaleString('en-IN')} to ${i.vendor} (${i.category ?? 'other'}) — it's in Accounting → Costs.`;
      }
    },
    {
      schema: {
        name: 'get_pipeline',
        description: 'Fetch the current leads pipeline snapshot (stages, values, next steps, notes).',
        input_schema: { type: 'object', properties: {} }
      },
      execute: async () => {
        const s = await db.collection('workshopLeads').orderBy('createdAt', 'desc').get();
        const leads = s.docs.map(d =>
          normalizeLead({ id: d.id, ...(d.data() as Omit<WorkshopLead, 'id'>) } as WorkshopLead & { type: string })
        );
        return describeLeads(leads);
      }
    }
  ];

  const sections = await loadContextSections();
  const reply = await runRhaiWithContext({
    model: modelFor('suggest'),
    maxTokens: 1500,
    system: buildRhaiSystemPrompt(sections) + whatsappAddendum(),
    priorMessages: prior,
    userContent: params.text,
    clientTools,
    extraTools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 } as unknown as Anthropic.Messages.Tool]
  });

  const now = Date.now();
  const next: StoredTurn[] = [
    ...stored,
    { role: 'user' as const, text: params.text, at: now },
    { role: 'rhai' as const, text: reply || '(no reply)', at: now }
  ].slice(-40);
  await sessRef.set(
    { messages: next, name: params.name ?? snap.data()?.name ?? '', updatedAt: now },
    { merge: true }
  );

  return reply || 'Got it.';
}
