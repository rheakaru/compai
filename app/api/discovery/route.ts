import { NextRequest } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase/admin';
import { anthropic, parseJsonLoose } from '@/lib/rhai/server';
import { modelFor } from '@/lib/rhai/models';
import {
  DISCOVERY_MAX_TURNS,
  DISCOVERY_OPENING,
  buildDiscoveryPrompt,
  type DiscoveryContact,
  type DiscoveryMessage,
  type DiscoverySession,
  type DiscoverySummary
} from '@/lib/rhai/discovery';
import { DAY_RATE_INR, type WorkshopLead } from '@/lib/leads/types';
import { validateContactFormat, firstError, normalizePhone } from '@/lib/validation/contact';
import { checkMailDomain } from '@/lib/validation/email-dns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// PUBLIC discovery-chat endpoint. Same sandboxing posture as /api/interview:
// no auth (by design), and the system prompt is built from a fixed brief only
// — no context vault, no tools, no pipeline. On completion Rhai extracts a
// structured summary, creates a WorkshopLead in the pipeline (Rhea sees it
// on the dashboard), and files a suggestion on the Today panel.

const COL_SESSIONS = 'rhaiDiscoverySessions';
const MAX_MSG_CHARS = 2000;

export async function POST(req: NextRequest) {
  const db = adminDb();
  const body = (await req.json().catch(() => ({}))) as {
    action?: 'start' | 'message';
    contact?: Partial<DiscoveryContact>;
    sessionId?: string;
    text?: string;
    audioUrl?: string;
  };

  // ---- start: contact info → session, static opening (no model call) ----
  if (body.action === 'start') {
    const c = body.contact ?? {};
    const name = c.name?.trim().slice(0, 80) ?? '';
    const email = c.email?.trim().slice(0, 120) ?? '';
    const phone = c.phone?.trim().slice(0, 30) ?? '';
    const company = c.company?.trim().slice(0, 120);

    // Layer 1 — format. Same rules the client enforces, re-checked here so the
    // API can't be hit directly with junk.
    const fmt = firstError(validateContactFormat({ name, email, phone }));
    if (fmt) return new Response(fmt, { status: 400 });
    // Layer 2 — can this email domain actually receive mail? Catches
    // structurally-valid fakes (x@fgdfg.com). Fails open on DNS trouble.
    if ((await checkMailDomain(email)) === 'no_domain')
      return new Response("That email address doesn't look like it can receive mail — please check it.", {
        status: 400
      });

    const opening: DiscoveryMessage = { role: 'rhai', text: DISCOVERY_OPENING, at: Date.now() };
    const session: Omit<DiscoverySession, 'id'> = {
      contact: { name, email, phone: normalizePhone(phone), ...(company ? { company } : {}) },
      messages: [opening],
      status: 'in_progress',
      createdAt: Date.now()
    };
    const ref = await db.collection(COL_SESSIONS).add(session);
    return Response.json({ sessionId: ref.id, message: opening.text });
  }

  // ---- message: one guest turn → one Rhai turn ----
  if (body.action === 'message') {
    const text = body.text?.trim().slice(0, MAX_MSG_CHARS);
    if (!body.sessionId || !text) return new Response('expected { sessionId, text }', { status: 400 });

    const ref = db.collection(COL_SESSIONS).doc(body.sessionId);
    const snap = await ref.get();
    if (!snap.exists) return new Response('session not found', { status: 404 });
    const session = { id: snap.id, ...(snap.data() as Omit<DiscoverySession, 'id'>) };
    if (session.status === 'completed') return new Response('discovery already completed', { status: 410 });

    const guestTurns = session.messages.filter(m => m.role === 'guest').length;
    if (guestTurns >= DISCOVERY_MAX_TURNS + 4) return new Response('turn limit reached', { status: 429 });

    const messages: Anthropic.Messages.MessageParam[] = [
      ...session.messages.map(m => ({
        role: m.role === 'rhai' ? ('assistant' as const) : ('user' as const),
        content: m.text
      })),
      { role: 'user', content: text }
    ];
    if (guestTurns >= DISCOVERY_MAX_TURNS) {
      messages.push({
        role: 'user',
        content: '[system note: turn limit reached — deliver your closing + marker now]'
      });
    }

    const msg = await anthropic().messages.create({
      model: modelFor('suggest'),
      max_tokens: 500,
      system: buildDiscoveryPrompt(session.contact),
      messages
    });
    let reply = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    const done = reply.includes('[DISCOVERY_COMPLETE]');
    reply = reply.replace(/\[DISCOVERY_COMPLETE\]/g, '').trim();

    const now = Date.now();
    // Only accept audioUrl if it's from our own bucket — belt-and-braces so a
    // client can't slip an arbitrary link into the message record.
    const audioUrl =
      body.audioUrl && /^https:\/\/storage\.googleapis\.com\/[^"'\s]+$/.test(body.audioUrl)
        ? body.audioUrl.slice(0, 500)
        : undefined;
    const newMessages: DiscoveryMessage[] = [
      ...session.messages,
      { role: 'guest', text, at: now, ...(audioUrl ? { audioUrl } : {}) },
      { role: 'rhai', text: reply, at: now }
    ];
    const update: Record<string, unknown> = { messages: newMessages };

    if (done) {
      update.status = 'completed';
      update.completedAt = now;
      try {
        const summary = await summarize({ ...session, messages: newMessages });
        update.summary = summary;
        const leadId = await createLead(session.contact, summary, newMessages);
        update.leadId = leadId;
      } catch {
        // summary + lead are best-effort; transcript is safely stored regardless
      }
    }

    await ref.set(update, { merge: true });
    return Response.json({ message: reply, done });
  }

  return new Response('unknown action', { status: 400 });
}

/** Structured summary of what the guest actually said. Used to shape the lead. */
async function summarize(
  session: DiscoverySession & { messages: DiscoveryMessage[] }
): Promise<DiscoverySummary> {
  const transcript = session.messages
    .map(m => `${m.role === 'rhai' ? 'RHAI' : session.contact.name.toUpperCase()}: ${m.text}`)
    .join('\n\n');

  const msg = await anthropic().messages.create({
    model: modelFor('draft'),
    max_tokens: 1000,
    system:
      'You compress a discovery-call transcript into a structured briefing for Rhea Karuturi. Faithful, concrete, in the guest\'s own words where useful — not sales spin. Return ONLY JSON.',
    messages: [
      {
        role: 'user',
        content: [
          `TRANSCRIPT:\n${transcript.slice(0, 24_000)}`,
          '',
          `Return ONLY JSON: {"headline": "<10-word: name @ company — what they want>", "overview": "<3-5 sentences: who they are, business, the ask>", "contextTags": ["<industry / size / geography / other 2-6 tags>"], "problem": "<their real problem, ideally in their words>", "timeline": "<exploring | months away | soon | urgent — and any date they mentioned>", "aiReadiness": "<none | casual (chat only) | building already — specifics>", "extras": "<anything else Rhea should know, including questions they asked>"}`
        ].join('\n')
      }
    ]
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');
  const parsed = parseJsonLoose<Partial<DiscoverySummary>>(text);
  return {
    headline: String(parsed.headline ?? '').slice(0, 200),
    overview: String(parsed.overview ?? '').slice(0, 1500),
    contextTags: (parsed.contextTags ?? []).map(t => String(t).slice(0, 40)).slice(0, 8),
    problem: String(parsed.problem ?? '').slice(0, 1500),
    timeline: String(parsed.timeline ?? '').slice(0, 200),
    aiReadiness: String(parsed.aiReadiness ?? '').slice(0, 300),
    extras: String(parsed.extras ?? '').slice(0, 1500)
  };
}

/**
 * Turn a completed discovery into a real pipeline lead + a suggestion on
 * Today. The transcript lands as the first note session on the lead so Rhea
 * can read the whole thing when she opens the client workspace.
 */
async function createLead(
  contact: DiscoveryContact,
  summary: DiscoverySummary,
  messages: DiscoveryMessage[]
): Promise<string> {
  const db = adminDb();
  const now = Date.now();

  const notesBody = [
    `**${summary.headline}**`,
    '',
    summary.overview,
    '',
    `**Problem:** ${summary.problem}`,
    `**Timeline:** ${summary.timeline}`,
    `**AI readiness:** ${summary.aiReadiness}`,
    summary.extras ? `**Extras:** ${summary.extras}` : '',
    summary.contextTags.length ? `**Tags:** ${summary.contextTags.join(', ')}` : '',
    '',
    `Contact — ${contact.email} · ${contact.phone}`
  ]
    .filter(Boolean)
    .join('\n');

  const lead: Omit<WorkshopLead, 'id'> = {
    type: 'company',
    billing: 'paid',
    person: contact.name,
    company: contact.company ?? '',
    dateLabel: '',
    stage: 'interested',
    likelihood: 'warm',
    nextSteps: 'Reply to discovery — email + WhatsApp with a proposed next step',
    estimatedDays: 2,
    dayRate: DAY_RATE_INR,
    checklist: {
      engagementEmailSent: false,
      prepReady: false,
      invoiceSent: false,
      closingEmailSent: false,
      paymentReminderSent: false,
      blogPostWritten: false,
      postedSocial: false
    },
    paymentReceived: false,
    jobConnect: false,
    smartNotes: notesBody,
    createdAt: now,
    updatedAt: now
  };

  const leadRef = await db.collection('workshopLeads').add(lead);

  // First note session — the full transcript, so opening the client workspace
  // shows the actual conversation. When a guest reply came from the mic, we
  // append a plain-URL line so the lead workspace (which renders the notes as
  // Markdown) surfaces the audio as a playable link, and Rhea can also click
  // to hear the actual voice.
  const transcript = messages
    .map(m => {
      const who = m.role === 'rhai' ? 'Rhai' : contact.name;
      const body = `**${who}:** ${m.text}`;
      return m.audioUrl ? `${body}\n🎙 [Play voice](${m.audioUrl})` : body;
    })
    .join('\n\n');
  await leadRef.collection('noteSessions').add({
    text: `[Discovery via heyrhai.com]\n\n${transcript.slice(0, 15_000)}`,
    source: 'discovery-chat',
    label: 'Discovery chat',
    at: now
  });

  // Suggestion on Today panel so Rhea sees this the moment she opens the app.
  await db.collection('rhaiSuggestions').add({
    kind: 'follow_up',
    title: `New discovery: ${summary.headline}`,
    detail: `${summary.overview}\n\nProblem: ${summary.problem}\nTimeline: ${summary.timeline}\nContact: ${contact.email} · ${contact.phone}\n\nOpen the lead workspace to read the full transcript.`,
    leadId: leadRef.id,
    leadLabel: [contact.name, contact.company].filter(Boolean).join(' · '),
    status: 'proposed',
    createdAt: now,
    updatedAt: now
  });

  return leadRef.id;
}
