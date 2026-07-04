import 'server-only';
import type { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { DEFAULT_CONTEXT_SECTIONS, type ContextSection, type RhaiIdea } from './types';
import type { WorkshopLead } from '@/lib/leads/types';
import { formatINR, leadValue } from '@/lib/leads/types';

// Firestore collections owned by the Rhai layer.
export const COL_CONTEXT = 'rhaiContext';
export const COL_IDEAS = 'rhaiIdeas';
export const COL_SUGGESTIONS = 'rhaiSuggestions';
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

export function buildRhaiSystemPrompt(sections: ContextSection[]): string {
  const vault = sections
    .filter(s => s.body.trim())
    .map(s => `### ${s.title}\n${s.body.trim()}`)
    .join('\n\n');
  return [
    BUSINESS_BRIEF,
    vault ? `\nCONTEXT VAULT (written by Rhea — weight this heavily):\n${vault}` : '',
    ''
  ].join('\n');
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
export function parseJsonLoose<T>(text: string): T {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.search(/[[{]/);
  if (start === -1) throw new Error('no JSON in model reply');
  return JSON.parse(raw.slice(start)) as T;
}
