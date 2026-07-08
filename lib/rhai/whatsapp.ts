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

// ---- the brain --------------------------------------------------------------

interface StoredTurn {
  role: 'user' | 'rhai';
  text: string;
  at: number;
}

const WHATSAPP_ADDENDUM = `
You are talking to Rhea over WhatsApp — she's on her phone, capturing things on the move. Keep replies short and skimmable: a few lines, plain text, no markdown headers or long essays. This is a primary capture channel — route what she gives you, don't just chat:
- A task/reminder for herself → call add_todo.
- An idea → call add_idea (a one-line take is welcome, but capture it first).
- Something to draft/prep for a client, or any actionable that shouldn't be lost → call propose_action so it lands on Today.
- Intel about a person → call update_person.
- Use get_pipeline before answering pipeline questions.
- You can brainstorm and sketch a proposal inline; the full proposal document gets built in the app, so offer to file it via propose_action.
- Briefly confirm what you saved. Warm, concrete, no filler.`;

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
    system: buildRhaiSystemPrompt(sections) + WHATSAPP_ADDENDUM,
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
