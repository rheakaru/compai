import { NextRequest } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase/admin';
import {
  COL_PEOPLE,
  buildRhaiSystemPrompt,
  loadContextSections,
  parseJsonLoose,
  requireOperator,
  runRhaiWithContext
} from '@/lib/rhai/server';
import { modelFor } from '@/lib/rhai/models';
import type { PersonLogEntry, RhaiPerson } from '@/lib/rhai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Union new connection edges with existing, dedup by name (case-insensitive). */
function mergeConnections(
  existing: { name: string; relationship: string; note?: string }[],
  incoming: { name: string; relationship: string; note?: string }[]
) {
  const byName = new Map(existing.map(c => [c.name.toLowerCase(), c]));
  for (const c of incoming) if (!byName.has(c.name.toLowerCase())) byName.set(c.name.toLowerCase(), c);
  return [...byName.values()].slice(0, 12);
}

// Rhai researches a person: web search on name + whatever context exists.
// Confident → writes a profile (summary, headline, links). Not confident →
// stores sharp questions for Rhea ("full name?", "LinkedIn URL?") so one
// answer unlocks the research. This is how the directory becomes intelligence.

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;

  const ref = adminDb().collection(COL_PEOPLE).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return new Response('not found', { status: 404 });
  const person = { id, ...(snap.data() as Omit<RhaiPerson, 'id'>) };

  const known = [
    person.headline && `Headline: ${person.headline}`,
    person.company && `Company: ${person.company}`,
    person.city && `City: ${person.city}`,
    person.links?.length && `Links: ${person.links.join(', ')}`,
    person.notes && `Rhea's notes: ${person.notes}`,
    person.notesLog?.length &&
      `Intel log:\n${person.notesLog.slice(-8).map(e => `- ${e.text}`).join('\n')}`
  ]
    .filter(Boolean)
    .join('\n');

  const sections = await loadContextSections();
  const text = await runRhaiWithContext({
    model: modelFor('research'),
    maxTokens: 3000,
    system: buildRhaiSystemPrompt(sections),
    extraTools: [
      { type: 'web_search_20250305', name: 'web_search', max_uses: 5 } as unknown as Anthropic.Messages.Tool
    ],
    userContent: [
      `Research this person from Rhea's network and build their profile:`,
      `NAME: ${person.name}`,
      known ? `WHAT WE KNOW:\n${known}` : '(nothing beyond the name)',
      ``,
      `1. read_context("community") first — they're likely in the directory with context, AND it tells you who else Rhea knows (for the connection map below).`,
      `2. Web-search them (name + company/city/india etc). Focus: who they are professionally, their company, anything relevant to Rhea's AI consulting (could they become a client, partner, or session host?).`,
      `3. SOCIAL GRAPH: from the community directory + notes, infer likely connections — who might have introduced them to Rhea, who they share a forum/committee/company/city with, mutual contacts. These are hypotheses to confirm, so hedge in the relationship text ("likely via…").`,
      `4. If you CANNOT confidently identify them (common name, no distinguishing info), do NOT guess — instead return questions for Rhea (e.g. "What's their full name?" or "Share their LinkedIn URL"). One good identifier unlocks everything.`,
      ``,
      `After any tool use, return ONLY JSON (plain text only — NO <cite> tags anywhere):`,
      `{"found": true|false, "summary": "<markdown profile: who they are, what they do, relevance to the business>", "headline": "<one line: role @ company>", "company": "", "city": "", "introducedBy": "<name or omit>", "connections": [{"name": "…", "relationship": "e.g. mutual / same YPO forum / likely introduced us", "note": "optional"}], "links": ["..."], "questions": ["..."]}`,
      `found=false → summary can be partial; questions must contain 1-2 sharp asks. Never fabricate links. connections may be [].`
    ].join('\n')
  });

  let parsed: {
    found?: boolean;
    summary?: string;
    headline?: string;
    company?: string;
    city?: string;
    introducedBy?: string;
    connections?: { name?: string; relationship?: string; note?: string }[];
    links?: string[];
    questions?: string[];
  };
  try {
    parsed = parseJsonLoose(text);
  } catch {
    return new Response('Rhai returned malformed research — try again', { status: 502 });
  }

  const now = Date.now();
  const entry: PersonLogEntry = {
    at: now,
    text: parsed.found
      ? `Researched: ${parsed.headline || 'profile updated'}`
      : `Research inconclusive — needs: ${(parsed.questions ?? []).join(' / ')}`,
    source: 'rhai'
  };
  const update: Record<string, unknown> = {
    status: parsed.found ? 'researched' : 'needs-info',
    ...(parsed.summary ? { summary: parsed.summary } : {}),
    ...(parsed.headline ? { headline: parsed.headline } : {}),
    ...(parsed.company ? { company: parsed.company } : {}),
    ...(parsed.city ? { city: parsed.city } : {}),
    ...(parsed.introducedBy ? { introducedBy: parsed.introducedBy } : {}),
    ...(Array.isArray(parsed.connections) && parsed.connections.length
      ? {
          connections: mergeConnections(
            person.connections ?? [],
            parsed.connections
              .filter(c => c?.name && c?.relationship)
              .map(c => ({ name: String(c.name), relationship: String(c.relationship), ...(c.note ? { note: String(c.note) } : {}) }))
          )
        }
      : {}),
    ...(Array.isArray(parsed.links) && parsed.links.length
      ? { links: [...new Set([...(person.links ?? []), ...parsed.links])].slice(0, 8) }
      : {}),
    questions: parsed.found ? [] : (parsed.questions ?? []).slice(0, 2),
    notesLog: [...(person.notesLog ?? []), entry],
    updatedAt: now
  };
  await ref.set(update, { merge: true });
  const fresh = await ref.get();
  return Response.json({ person: { id, ...(fresh.data() as Omit<RhaiPerson, 'id'>) } });
}
