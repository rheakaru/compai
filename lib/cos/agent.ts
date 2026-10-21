import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase/admin';
import { anthropic } from '@/lib/rhai/server';
import { modelFor } from '@/lib/rhai/models';
import { buildCosSystemPrompt } from './prompt';
import { COL_AGENTS, COL_REMINDERS, COL_SESSIONS, getAgent } from './store';
import { insertEvent, listEvents, readMail, searchMail } from './google';
import type { CosAgent } from './types';

// The Chief of Staff brain. One function, two channels (WhatsApp + the web
// console on the setup page), one shared memory per person. Tools are gated
// by the person's own toolFlags and by whether Google is connected.

const MAX_TURNS_KEPT = 30;
const MAX_ROUNDS = 5;
/** Per-person ceiling — 150 people in a room, one shared API key. */
const HOURLY_MESSAGE_CAP = 60;

interface StoredTurn {
  role: 'user' | 'agent';
  text: string;
  at: number;
  channel: 'whatsapp' | 'web';
}

export function nowIst(): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(new Date());
}

/** "YYYY-MM-DD" and "HH:mm" in IST for today. */
export function istParts(d = new Date()): { date: string; time: string } {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = Object.fromEntries(f.formatToParts(d).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** IST wall-clock "YYYY-MM-DDTHH:mm" -> epoch ms. */
export function istToEpoch(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00+05:30`);
}

function addMinutes(date: string, time: string, mins: number): { date: string; time: string } {
  const d = new Date(istToEpoch(date, time) + mins * 60_000);
  return istParts(d);
}

export async function buildCosReply(params: {
  agent: CosAgent;
  text: string;
  channel: 'whatsapp' | 'web';
}): Promise<string> {
  const { agent, text, channel } = params;
  const db = adminDb();
  const sessRef = db.collection(COL_SESSIONS).doc(agent.uid);
  const snap = await sessRef.get();
  const stored = (snap.data()?.messages ?? []) as StoredTurn[];

  // Rate cap: count user turns in the last hour.
  const hourAgo = Date.now() - 3600_000;
  const recent = stored.filter(m => m.role === 'user' && m.at > hourAgo).length;
  if (recent >= HOURLY_MESSAGE_CAP) {
    return "I've hit my hourly limit for now — give me a little while and try again.";
  }

  const prior: Anthropic.Messages.MessageParam[] = stored
    .filter(m => m.text?.trim())
    .slice(-MAX_TURNS_KEPT)
    .map(m => ({ role: m.role === 'agent' ? ('assistant' as const) : ('user' as const), content: m.text }));

  const tools = buildTools(agent);
  const executors = new Map(tools.map(t => [t.schema.name, t.execute] as const));
  const system = buildCosSystemPrompt(agent, { channel, nowIst: nowIst() });
  const messages: Anthropic.Messages.MessageParam[] = [...prior, { role: 'user', content: text }];

  let reply = '';
  for (let round = 0; round <= MAX_ROUNDS; round++) {
    const msg = await anthropic().messages.create({
      model: modelFor('cosChat'),
      max_tokens: 1200,
      system,
      tools: tools.map(t => t.schema),
      messages,
      // Opus 5.5: thinking is always on; low effort keeps chat snappy. The
      // pinned SDK predates output_config, so it rides along untyped.
      ...({ output_config: { effort: 'low' } } as object)
    });

    const toolUses = msg.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && executors.has(b.name)
    );
    const textOut = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    if (msg.stop_reason !== 'tool_use' || toolUses.length === 0 || round === MAX_ROUNDS) {
      reply = textOut;
      break;
    }
    messages.push({ role: 'assistant', content: msg.content });
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      let result: string;
      try {
        result = await executors.get(tu.name)!(tu.input);
      } catch (e) {
        result = `tool error: ${e instanceof Error ? e.message : 'failed'}`;
      }
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: result });
    }
    messages.push({ role: 'user', content: results });
  }

  if (!reply) reply = "Sorry — I lost my train of thought. Could you say that again?";

  const now = Date.now();
  const next: StoredTurn[] = [
    ...stored,
    { role: 'user' as const, text: text.slice(0, 4000), at: now, channel },
    { role: 'agent' as const, text: reply.slice(0, 4000), at: now, channel }
  ].slice(-MAX_TURNS_KEPT * 2);
  await sessRef.set({ messages: next, updatedAt: now }, { merge: true });
  return reply;
}

export async function recentTurns(uid: string, n = 20): Promise<StoredTurn[]> {
  const snap = await adminDb().collection(COL_SESSIONS).doc(uid).get();
  return ((snap.data()?.messages ?? []) as StoredTurn[]).slice(-n);
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
interface ToolDef {
  schema: Anthropic.Messages.Tool;
  execute: (input: unknown) => Promise<string>;
}

function buildTools(agent: CosAgent): ToolDef[] {
  const f = agent.spec.toolFlags;
  const uid = agent.uid;
  const hasCal = !!agent.google && (agent.google.scopes ?? []).some(s => s.includes('calendar'));
  const hasMail = !!agent.google && (agent.google.scopes ?? []).some(s => s.includes('gmail'));
  const notConnected = (what: string) =>
    `${what} is not connected yet. Tell them to open heyrhai.com/chief-of-staff and connect Google there.`;

  const tools: ToolDef[] = [
    {
      schema: {
        name: 'remember',
        description:
          'Save a durable fact about the principal for future conversations (a preference, a person, a recurring commitment). Not for small talk.',
        input_schema: { type: 'object', properties: { fact: { type: 'string' } }, required: ['fact'] }
      },
      execute: async input => {
        const fact = String((input as { fact?: string }).fact ?? '').trim().slice(0, 300);
        if (!fact) return 'nothing to remember';
        const memory = [...agent.memory, fact].slice(-40);
        agent.memory = memory;
        await adminDb().collection(COL_AGENTS).doc(uid).set({ memory, updatedAt: Date.now() }, { merge: true });
        return `Remembered: ${fact}`;
      }
    }
  ];

  if (f.reminders) {
    tools.push({
      schema: {
        name: 'set_reminder',
        description:
          'Schedule a WhatsApp reminder for the principal at a specific IST date and time. Use when they ask to be reminded of something.',
        input_schema: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD (Asia/Kolkata)' },
            time: { type: 'string', description: 'HH:mm 24h (Asia/Kolkata)' },
            text: { type: 'string', description: 'What to say when it fires' }
          },
          required: ['date', 'time', 'text']
        }
      },
      execute: async input => {
        const i = input as { date?: string; time?: string; text?: string };
        const date = String(i.date ?? '');
        const time = String(i.time ?? '');
        const text = String(i.text ?? '').trim().slice(0, 500);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !text) {
          return 'tool error: need date YYYY-MM-DD, time HH:mm (IST) and text';
        }
        const dueAt = istToEpoch(date, time);
        if (!Number.isFinite(dueAt)) return 'tool error: bad date/time';
        if (dueAt < Date.now() - 60_000) return 'tool error: that time is already past';
        if (!agent.profile.phoneDigits) return 'tool error: no WhatsApp number on file — they need to add one on the setup page';
        await adminDb().collection(COL_REMINDERS).add({
          uid,
          to: agent.profile.phoneDigits,
          text,
          dueAt,
          sent: false,
          createdAt: Date.now()
        });
        return `Reminder set for ${date} ${time} IST: ${text}`;
      }
    });
  }

  if (f.calendarRead) {
    tools.push({
      schema: {
        name: 'get_calendar',
        description: "List the principal's upcoming Google Calendar events. Default: the next 2 days.",
        input_schema: {
          type: 'object',
          properties: { daysAhead: { type: 'number', description: '1–14, default 2' } }
        }
      },
      execute: async input => {
        if (!hasCal) return notConnected('Google Calendar');
        const days = Math.min(Math.max(Number((input as { daysAhead?: number }).daysAhead ?? 2) || 2, 1), 14);
        const from = new Date();
        const to = new Date(Date.now() + days * 86_400_000);
        const events = await listEvents(uid, from, to);
        if (!events.length) return `No events in the next ${days} day(s).`;
        return events
          .map(e => {
            const when = e.allDay ? `${e.start} (all day)` : fmtIst(e.start) + '–' + fmtIst(e.end, true);
            return `• ${when} — ${e.summary}${e.location ? ` @ ${e.location}` : ''}${e.attendees.length ? ` (with ${e.attendees.slice(0, 5).join(', ')})` : ''}${e.meet ? ` [Meet]` : ''}`;
          })
          .join('\n');
      }
    });
  }

  if (f.calendarWrite) {
    tools.push({
      schema: {
        name: 'create_event',
        description: "Create an event on the principal's primary Google Calendar (Asia/Kolkata). Confirm details with them first if anything is ambiguous.",
        input_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD' },
            time: { type: 'string', description: 'HH:mm 24h IST' },
            durationMins: { type: 'number', description: 'default 30' },
            attendees: { type: 'array', items: { type: 'string' }, description: 'emails (optional)' },
            description: { type: 'string' }
          },
          required: ['title', 'date', 'time']
        }
      },
      execute: async input => {
        if (!hasCal) return notConnected('Google Calendar');
        const i = input as { title?: string; date?: string; time?: string; durationMins?: number; attendees?: string[]; description?: string };
        const title = String(i.title ?? '').trim();
        const date = String(i.date ?? '');
        const time = String(i.time ?? '');
        if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return 'tool error: need title, date, time';
        const mins = Number.isFinite(i.durationMins) && (i.durationMins as number) > 0 ? Math.round(i.durationMins as number) : 30;
        const end = addMinutes(date, time, mins);
        const attendees = (i.attendees ?? []).map(String).filter(e => /.+@.+\..+/.test(e));
        const ev = await insertEvent(uid, {
          summary: title,
          ...(i.description ? { description: String(i.description).slice(0, 2000) } : {}),
          startIst: `${date}T${time}:00`,
          endIst: `${end.date}T${end.time}:00`,
          attendees
        });
        return `Created "${title}" on ${date} at ${time} IST (${mins} min).${attendees.length ? ` Invited ${attendees.join(', ')}.` : ''}${ev.meet ? ` Meet: ${ev.meet}` : ''} ${ev.htmlLink}`;
      }
    });
  }

  if (f.gmailRead) {
    tools.push(
      {
        schema: {
          name: 'search_email',
          description:
            "Search the principal's Gmail. Uses Gmail search syntax (from:, subject:, newer_than:2d, is:unread…). Returns headers + snippets; use read_email for a full message.",
          input_schema: {
            type: 'object',
            properties: { query: { type: 'string' }, max: { type: 'number', description: 'default 8, max 15' } },
            required: ['query']
          }
        },
        execute: async input => {
          if (!hasMail) return notConnected('Gmail');
          const i = input as { query?: string; max?: number };
          const q = String(i.query ?? '').trim() || 'newer_than:2d';
          const heads = await searchMail(uid, q, Number(i.max ?? 8) || 8);
          if (!heads.length) return `No emails match "${q}".`;
          return heads
            .map(h => `[${h.id}] ${h.date} — from ${h.from}\n  ${h.subject}\n  ${h.snippet}`)
            .join('\n');
        }
      },
      {
        schema: {
          name: 'read_email',
          description: 'Read one email in full by the id returned from search_email.',
          input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
        },
        execute: async input => {
          if (!hasMail) return notConnected('Gmail');
          const id = String((input as { id?: string }).id ?? '').trim();
          if (!id) return 'tool error: need id';
          const { head, body } = await readMail(uid, id);
          return `From: ${head.from}\nSubject: ${head.subject}\nDate: ${head.date}\n\n${body}`;
        }
      }
    );
  }

  return tools;
}

function fmtIst(iso: string, timeOnly = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    ...(timeOnly ? {} : { weekday: 'short', day: 'numeric', month: 'short' }),
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
}

/** Load a fresh copy and answer — used by both the webhook and the web console. */
export async function replyForUid(uid: string, text: string, channel: 'whatsapp' | 'web'): Promise<string | null> {
  const agent = await getAgent(uid);
  if (!agent) return null;
  return buildCosReply({ agent, text, channel });
}
