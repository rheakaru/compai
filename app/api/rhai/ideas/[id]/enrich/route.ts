import { NextRequest } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase/admin';
import {
  COL_IDEAS,
  anthropic,
  buildRhaiSystemPrompt,
  loadContextSections,
  parseJsonLoose,
  requireOperator
} from '@/lib/rhai/server';
import { modelFor } from '@/lib/rhai/models';
import type { RhaiIdea } from '@/lib/rhai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Rhai enriches a parked idea: researches the people/orgs mentioned (web
// search), pulls in the context vault, and returns either a brainstorm or the
// questions it needs answered first. "Should ask aishwarya if we can do this
// with her school" → research Aishwarya, or ask who she is if ambiguous.

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;

  const ref = adminDb().collection(COL_IDEAS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return new Response('not found', { status: 404 });
  const idea = { id, ...(snap.data() as Omit<RhaiIdea, 'id'>) };

  await ref.set({ status: 'researching', updatedAt: Date.now() }, { merge: true });

  try {
    const sections = await loadContextSections();
    const msg = await anthropic().messages.create({
      model: modelFor('research'),
      max_tokens: 4000,
      system: buildRhaiSystemPrompt(sections),
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 6
        } as unknown as Anthropic.Messages.Tool
      ],
      messages: [
        {
          role: 'user',
          content: [
            `Rhea parked this idea in the scratchpad:\n\n"${idea.text}"`,
            idea.extraContext ? `\nExtra context she added since:\n${idea.extraContext}` : '',
            idea.enrichment ? `\nYour previous enrichment (build on it, don't repeat):\n${idea.enrichment}` : '',
            `\nDo your cofounder pass on this idea:`,
            `1. Identify the people/orgs mentioned. If identifiable, use web_search to learn who they are and what the org does. Check the context vault first — she may have already told you.`,
            `2. Brainstorm concretely how this could become a session, partnership, or lead: the angle, the likely format (free org session vs paid engagement), what to pitch, realistic value.`,
            `3. If you're missing something only Rhea knows, ask — max 3 sharp questions.`,
            `\nReturn ONLY JSON: {"enrichment": "<markdown: who they are + the brainstorm + suggested next move>", "questions": ["…"]} — questions may be an empty array if you have enough.`
          ].join('\n')
        }
      ]
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n');
    const parsed = parseJsonLoose<{ enrichment: string; questions?: string[] }>(text);

    const update = {
      status: 'brainstormed' as const,
      enrichment: parsed.enrichment,
      questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3) : [],
      updatedAt: Date.now()
    };
    await ref.set(update, { merge: true });
    return Response.json({ idea: { ...idea, ...update } });
  } catch (e) {
    // Roll back the transient status so the idea isn't stuck on "researching".
    await ref.set({ status: idea.status === 'researching' ? 'parked' : idea.status, updatedAt: Date.now() }, { merge: true });
    return new Response(e instanceof Error ? e.message : 'enrichment failed', { status: 500 });
  }
}
