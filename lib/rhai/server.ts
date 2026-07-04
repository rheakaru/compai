import 'server-only';
import type { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import {
  DEFAULT_CONTEXT_SECTIONS,
  SECTION_MODE,
  type ContextSection,
  type RhaiIdea
} from './types';
import { modelFor } from './models';
import type { WorkshopLead } from '@/lib/leads/types';
import { formatINR, leadValue } from '@/lib/leads/types';

// Firestore collections owned by the Rhai layer.
export const COL_CONTEXT = 'rhaiContext';
export const COL_IDEAS = 'rhaiIdeas';
export const COL_SUGGESTIONS = 'rhaiSuggestions';
export const COL_PEOPLE = 'rhaiPeople';
export const COL_CHAT = 'rhaiChat';
export const DOC_SKILLS = 'rhaiConfig/skills';

export async function requireOperator(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) return { error: new Response('unauthorized', { status: 401 }) };
  if (!user.operator) return { error: new Response('forbidden — operator only', { status: 403 }) };
  return { user };
}

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

/** Context vault sections, seeding defaults for any that don't exist yet. */
export async function loadContextSections(): Promise<ContextSection[]> {
  const snap = await adminDb().collection(COL_CONTEXT).get();
  const byId = new Map(snap.docs.map(d => [d.id, { id: d.id, ...(d.data() as Omit<ContextSection, 'id'>) }]));
  return DEFAULT_CONTEXT_SECTIONS.map(
    def => byId.get(def.id) ?? { ...def, updatedAt: 0 }
  );
}

// ---------------------------------------------------------------------------
// Rhai persona — the system prompt. The stable business facts live here; the
// living context (about/networks/thinking/demos/templates) is injected from
// the vault so Rhai literally gets smarter as Rhea writes more down.
// ---------------------------------------------------------------------------

const BUSINESS_BRIEF = `
You are Rhai — Rhea Karuturi's AI cofounder for her AI consulting business. Not an assistant: a business partner who thinks about the business proactively, along the same lines she does, and does real work.

THE BUSINESS (from rheakaru.github.io/sessions.html):
- One-day AI hackathons inside companies: Rhea builds AI tools WITH the client's team, on their machines, with their API keys and data — "teaching your team to fish, not selling fish." Client owns everything from minute one.
- Structure: recce day(s) first (immersion in their ops, systems, spreadsheets, quiet friction), then a build day (2-3h teaching with Hoovu examples, ~2h guided building, 1:1 with senior leadership). One senior person present throughout is non-negotiable.
- Pricing: ₹1 lakh/day, typical engagement ₹2-3L (1 build + 1-2 recce). Same-day payment. Travel at cost outside Bangalore. Rates non-negotiable. Bangalore + SF only.
- Credibility: 7 years as CTO of Hoovu Fresh (B2B puja-flower supply chain, 9 cities, ~₹20cr, Shark Tank India). Stanford STS. Case study: Bliss Aerospace — "twenty thousand parts, no single screen to plan them on; we built that screen in an afternoon."

THE FUNNEL:
interest ping → WhatsApp discovery call → smart notes (in this dashboard) → action items → recce trip / more calls → project in Claude with requirements → deck (presentation skills) → intro email with terms → proposal + costing by email → confirm call → schedule session → invoice + pre-session email → session → payment follow-up → closing email with resources → blog post → social.
Top of funnel stays alive through: the ~350-member "Hang with AI" group (free weekly sessions), org sessions & partnerships (CREDAI, YPO, EO, FICCI FLO…), posted projects, word of mouth.

HER GOALS:
1) Teach AI at scale (grow the base). 2) Convert 4 companies/month into ₹3L engagements. 3) Land an AI role in SF via connects made through this work (job-connect flagged leads).

HOW YOU OPERATE:
- Draft-only autonomy: you prepare emails, invoices, proposals, research, demo plans — but NOTHING goes out to a client and no money moves without Rhea's explicit approval. Suggest, stage, ask.
- Be concrete. "Draft the closing email for Riddhi with the session resources" beats "consider following up."
- Read her smart notes on each lead carefully — they are the source of truth on what the client actually needs. If notes mention a client want (e.g. "morning briefing from WhatsApp chats"), propose researching + building it.
- On quiet days (few urgent to-dos), surface parked ideas and network plays instead of inventing busywork.
- Match her voice: warm, direct, no corporate filler, trust as the throughline.
`.trim();

// ---------------------------------------------------------------------------
// Tiered memory — the AIMemory pattern applied to Rhai itself.
// Core sections load in full; library sections load as digest index cards,
// with the full body one `read_context` tool call away. Rhai always knows
// what it has; it pays for the big documents only when a task needs them.
// ---------------------------------------------------------------------------

export function buildRhaiSystemPrompt(sections: ContextSection[]): string {
  const defs = new Map(DEFAULT_CONTEXT_SECTIONS.map(d => [d.id, d]));

  const core = sections
    .filter(s => SECTION_MODE[s.id] !== 'library' && s.body.trim())
    .map(s => `### ${s.title}\n${s.body.trim()}`)
    .join('\n\n');

  const index = sections
    .filter(s => SECTION_MODE[s.id] === 'library' && s.body.trim())
    .map(s => {
      const def = defs.get(s.id);
      const kb = (s.body.length / 1024).toFixed(0);
      return [
        `• id: "${s.id}" — ${s.title} (${kb}kb)`,
        `  When to read: ${def?.whenToUse ?? 'when relevant'}`,
        `  At a glance: ${s.digest?.trim() || '(digest pending — read the full doc if potentially relevant)'}`
      ].join('\n');
    })
    .join('\n');

  return [
    BUSINESS_BRIEF,
    core ? `\nCONTEXT VAULT (written by Rhea — weight this heavily):\n${core}` : '',
    index
      ? `\nCONTEXT LIBRARY (full documents available via the read_context tool — the cards below are only summaries):\n${index}\n\nUse read_context BEFORE answering when a task touches a library topic — e.g. naming specific community members, picking demo features for a client, or planning session content. Never invent specifics that would live in a library doc; read it instead. Skip the tool when the task clearly doesn't need it.`
      : '',
    ''
  ].join('\n');
}

/** Tool schema for on-demand context reads. */
export const READ_CONTEXT_TOOL: Anthropic.Messages.Tool = {
  name: 'read_context',
  description:
    'Fetch the full text of a context-library document by its id (see CONTEXT LIBRARY in the system prompt). Use before making claims that depend on its contents.',
  input_schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Library section id, e.g. "community", "demos", "teaching".' }
    },
    required: ['id']
  }
};

const MAX_SECTION_CHARS = 40_000; // ~10k tokens ceiling per fetch

async function fetchSectionBody(id: string): Promise<string> {
  const snap = await adminDb().collection(COL_CONTEXT).doc(id).get();
  const body = (snap.data()?.body as string | undefined)?.trim();
  if (!body) return `(no document stored under id "${id}")`;
  return body.length > MAX_SECTION_CHARS ? body.slice(0, MAX_SECTION_CHARS) + '\n…(truncated)' : body;
}

/** A client-side tool Rhai can call: schema + the function that executes it. */
export interface RhaiToolDef {
  schema: Anthropic.Messages.Tool;
  execute: (input: unknown) => Promise<string>;
}

/**
 * Run a Rhai call with the read_context tool, optional executable client
 * tools (update_person, propose_action…), and optional server tools (e.g.
 * web_search, which Anthropic executes remotely). Handles the tool loop and
 * returns the final text. Prior conversation turns can be passed for chat.
 */
export async function runRhaiWithContext(params: {
  model: string;
  maxTokens: number;
  system: string;
  userContent: string;
  priorMessages?: Anthropic.Messages.MessageParam[];
  clientTools?: RhaiToolDef[];
  extraTools?: Anthropic.Messages.Tool[]; // server-executed tools (web_search)
  maxRounds?: number;
  onToolNote?: (note: string) => void;
}): Promise<string> {
  const {
    model,
    maxTokens,
    system,
    userContent,
    priorMessages = [],
    clientTools = [],
    extraTools = [],
    maxRounds = 6,
    onToolNote
  } = params;

  const executors = new Map<string, RhaiToolDef['execute']>([
    ['read_context', async input => fetchSectionBody(String((input as { id?: string })?.id ?? ''))],
    ...clientTools.map(t => [t.schema.name, t.execute] as const)
  ]);
  const tools = [READ_CONTEXT_TOOL, ...clientTools.map(t => t.schema), ...extraTools];
  const messages: Anthropic.Messages.MessageParam[] = [
    ...priorMessages,
    { role: 'user', content: userContent }
  ];

  for (let round = 0; round <= maxRounds; round++) {
    const msg = await anthropic().messages.create({
      model,
      max_tokens: maxTokens,
      system,
      tools,
      messages
    });

    const toolUses = msg.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && executors.has(b.name)
    );
    if (msg.stop_reason !== 'tool_use' || toolUses.length === 0 || round === maxRounds) {
      return stripCitations(
        msg.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('\n')
      );
    }

    messages.push({ role: 'assistant', content: msg.content });
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      let result: string;
      try {
        result = await executors.get(tu.name)!(tu.input);
        if (tu.name !== 'read_context') onToolNote?.(result);
      } catch (e) {
        result = `tool error: ${e instanceof Error ? e.message : 'failed'}`;
      }
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: result });
    }
    messages.push({ role: 'user', content: results });
  }
  return '';
}

// ---------------------------------------------------------------------------
// Digest generation — the always-loaded summary card for a library doc.
// Haiku-class, runs once per document change (fractions of a cent).
// ---------------------------------------------------------------------------

export async function generateDigest(title: string, body: string): Promise<string> {
  const msg = await anthropic().messages.create({
    model: modelFor('digest'),
    max_tokens: 400,
    system:
      'You compress reference documents into index cards for an AI agent. Write a single dense paragraph (max ~100 words): what the document contains, its key categories/counts, and 2-3 standout specifics an agent should remember exist. No preamble, no markdown.',
    messages: [
      {
        role: 'user',
        content: `Document title: ${title}\n\n${body.slice(0, 30_000)}`
      }
    ]
  });
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join(' ')
    .trim();
}

/** Compact, token-efficient snapshot of the pipeline for prompts. */
export function describeLeads(leads: WorkshopLead[]): string {
  if (leads.length === 0) return '(pipeline is empty)';
  return leads
    .map(l => {
      const bits = [
        `• [${l.id}] ${l.person || '?'}${l.company ? ` @ ${l.company}` : ''}`,
        `type=${l.type}/${l.billing}, stage=${l.stage}, strength=${l.likelihood}`,
        l.billing === 'paid' ? `value=${formatINR(leadValue(l))}${l.paymentReceived ? ' (PAID)' : ''}` : null,
        l.nextSteps ? `next=${l.nextSteps}` : null,
        l.workshopDate ? `workshop=${l.workshopDate}` : null,
        l.recce?.date ? `recce=${l.recce.date}` : null,
        checklistGaps(l)
      ].filter(Boolean);
      const notes = (l.smartNotes ?? '').trim();
      return (
        bits.join(' | ') +
        (notes ? `\n  notes: ${notes.length > 600 ? notes.slice(0, 600) + '…' : notes}` : '')
      );
    })
    .join('\n');
}

function checklistGaps(l: WorkshopLead): string | null {
  const c = l.checklist;
  if (!c) return null;
  const gaps: string[] = [];
  if (!c.engagementEmailSent) gaps.push('no engagement email');
  if (!c.prepReady) gaps.push('prep not ready');
  if (!c.invoiceSent) gaps.push('no invoice');
  if (!c.closingEmailSent) gaps.push('no closing email');
  if (!c.blogPostWritten) gaps.push('no blog post');
  return gaps.length ? `gaps: ${gaps.join(', ')}` : null;
}

export function describeIdeas(ideas: RhaiIdea[]): string {
  const open = ideas.filter(i => i.status === 'parked' || i.status === 'brainstormed');
  if (open.length === 0) return '(no parked ideas)';
  return open
    .map(i => `• [${i.id}] (${i.status}) ${i.text}${i.extraContext ? ` — extra: ${i.extraContext}` : ''}`)
    .join('\n');
}

/** Extract the first JSON array/object from a model reply (tolerates fences). */
/**
 * Web search wraps grounded spans in <cite index="…">…</cite> tags. They're
 * useful to the model mid-reasoning but must never reach the UI. Keep the
 * inner text, drop the tags.
 */
export function stripCitations(text: string): string {
  return text.replace(/<\/?cite[^>]*>/gi, '');
}

export function parseJsonLoose<T>(text: string): T {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.search(/[[{]/);
  if (start === -1) throw new Error('no JSON in model reply');
  return JSON.parse(raw.slice(start)) as T;
}
