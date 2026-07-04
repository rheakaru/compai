import { NextRequest } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase/admin';
import {
  COL_CHAT,
  COL_SUGGESTIONS,
  buildRhaiSystemPrompt,
  describeLeads,
  loadContextSections,
  requireOperator,
  runRhaiWithContext,
  type RhaiToolDef
} from '@/lib/rhai/server';
import { upsertPersonIntel } from '@/lib/rhai/people';
import { modelFor } from '@/lib/rhai/models';
import { normalizeLead, type WorkshopLead } from '@/lib/leads/types';
import type { RhaiChatMessage, SuggestionKind } from '@/lib/rhai/types';
import { SUGGESTION_KIND_LABELS } from '@/lib/rhai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// The persistent conversation with Rhai. Messages live in Firestore forever —
// this is where Rhea feeds context, and Rhai routes what it learns to the
// right place (person profiles, suggestions) via tools, never silently.

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const snap = await adminDb().collection(COL_CHAT).orderBy('at', 'desc').limit(80).get();
  const messages = snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<RhaiChatMessage, 'id'>) }))
    .reverse();
  return Response.json({ messages });
}

export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = body.text?.trim();
  if (!text) return new Response('expected { text }', { status: 400 });

  const db = adminDb();
  const now = Date.now();
  await db.collection(COL_CHAT).add({ role: 'user', text, at: now });

  // Conversation memory: the last ~30 turns ride along.
  const historySnap = await db.collection(COL_CHAT).orderBy('at', 'desc').limit(31).get();
  const prior: Anthropic.Messages.MessageParam[] = historySnap.docs
    .map(d => d.data() as Omit<RhaiChatMessage, 'id'>)
    .reverse()
    .slice(0, -1) // exclude the message we just stored; it goes in as userContent
    .filter(m => m.text?.trim())
    .map(m => ({ role: m.role === 'rhai' ? 'assistant' : 'user', content: m.text }));

  const toolNotes: string[] = [];
  const validKinds = new Set(Object.keys(SUGGESTION_KIND_LABELS));

  const clientTools: RhaiToolDef[] = [
    {
      schema: {
        name: 'update_person',
        description:
          'Save intel about a person to their profile (creates the person if new). Use whenever Rhea shares context about someone — names, roles, orgs, what they want. The note is appended to their intel log.',
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Person’s name as Rhea refers to them' },
            note: { type: 'string', description: 'The intel to record, one or two sentences' },
            headline: { type: 'string', description: 'Optional: role @ company one-liner' },
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
        return `${created ? 'Created profile' : 'Updated profile'}: ${person.name} — "${i.note}"`;
      }
    },
    {
      schema: {
        name: 'propose_action',
        description:
          'File a suggestion on the Today panel for Rhea to approve (draft an email, research something, prep a deck…). Use when the conversation surfaces something actionable that shouldn’t be lost.',
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
        const doc = {
          kind: (validKinds.has(i.kind) ? i.kind : 'follow_up') as SuggestionKind,
          title: i.title.slice(0, 200),
          detail: i.detail.slice(0, 2000),
          ...(i.leadLabel ? { leadLabel: i.leadLabel.slice(0, 120) } : {}),
          status: 'proposed' as const,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await db.collection(COL_SUGGESTIONS).add(doc);
        return `Filed suggestion on the Today panel: ${i.title}`;
      }
    },
    {
      schema: {
        name: 'get_pipeline',
        description: 'Fetch the current leads pipeline snapshot (stages, values, next steps, notes).',
        input_schema: { type: 'object', properties: {} }
      },
      execute: async () => {
        const snap = await db.collection('workshopLeads').orderBy('createdAt', 'desc').get();
        const leads = snap.docs.map(d =>
          normalizeLead({ id: d.id, ...(d.data() as Omit<WorkshopLead, 'id'>) } as WorkshopLead & { type: string })
        );
        return describeLeads(leads);
      }
    }
  ];

  const sections = await loadContextSections();
  const reply = await runRhaiWithContext({
    model: modelFor('suggest'),
    maxTokens: 2000,
    system:
      buildRhaiSystemPrompt(sections) +
      `\nYou are in your standing chat with Rhea. This conversation persists forever — it is a primary channel for her to feed you context. Rules:\n- When she shares intel about a person, call update_person so it lands on their profile (tell her you did).\n- When something actionable surfaces, call propose_action rather than letting it evaporate.\n- Use get_pipeline before answering pipeline questions; read_context for library topics; web_search for the outside world.\n- Be a cofounder: brief, concrete, warm. No corporate filler. Ask sharp questions when her input is ambiguous (e.g. which person a name refers to).`,
    priorMessages: prior,
    userContent: text,
    clientTools,
    extraTools: [
      { type: 'web_search_20250305', name: 'web_search', max_uses: 4 } as unknown as Anthropic.Messages.Tool
    ],
    onToolNote: note => toolNotes.push(note)
  });

  const rhaiMsg: Omit<RhaiChatMessage, 'id'> = {
    role: 'rhai',
    text: reply || '(no reply)',
    ...(toolNotes.length ? { toolNotes } : {}),
    at: Date.now()
  };
  const ref = await db.collection(COL_CHAT).add(rhaiMsg);
  return Response.json({ message: { id: ref.id, ...rhaiMsg } });
}
