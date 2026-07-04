import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  buildRhaiSystemPrompt,
  loadContextSections,
  parseJsonLoose,
  requireOperator,
  runRhaiWithContext
} from '@/lib/rhai/server';
import { buildLeadContext } from '@/lib/rhai/leadContext';
import { modelFor } from '@/lib/rhai/models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Rebuild Rhai's understanding of a client from all note sessions.
// Summary + top-5 bullets — "so I know we're on the same page."

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;

  const built = await buildLeadContext(id);
  if (!built) return new Response('not found', { status: 404 });

  const sections = await loadContextSections();
  const text = await runRhaiWithContext({
    model: modelFor('suggest'),
    maxTokens: 1500,
    system: buildRhaiSystemPrompt(sections),
    userContent: [
      `Rebuild your understanding of this client from everything below. This is the shared ground truth between you and Rhea — precise, concrete, her language.`,
      ``,
      built.context,
      ``,
      `Return ONLY JSON: {"summary": "<2-3 sentences: who they are, what they want, where the engagement stands>", "bullets": ["<the 5 things that matter most right now — client wants, constraints, risks, commitments made>"]}`,
      `Exactly 5 bullets, each one line. If notes conflict, the newer session wins.`
    ].join('\n')
  });

  let parsed: { summary?: string; bullets?: string[] };
  try {
    parsed = parseJsonLoose(text);
  } catch {
    return new Response('malformed understanding — try again', { status: 502 });
  }

  const understanding = {
    summary: String(parsed.summary ?? '').slice(0, 1200),
    bullets: (parsed.bullets ?? []).slice(0, 5).map(b => String(b).slice(0, 300)),
    updatedAt: Date.now()
  };
  await adminDb().collection('workshopLeads').doc(id).set({ understanding, updatedAt: Date.now() }, { merge: true });
  return Response.json({ understanding });
}
