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
import type { LeadScanAction } from '@/lib/leads/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// The client scan — Rhai as proactive business partner on this case.
// Reads the full client context and proposes executable next actions
// (industry research, solution research for client-requested tools, drafts,
// deck prep). Cached on the lead; regenerated on demand.

const VALID_KINDS = new Set<LeadScanAction['kind']>([
  'research_industry',
  'research_solution',
  'draft_email',
  'draft_proposal',
  'prep_deck',
  'other'
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;

  const built = await buildLeadContext(id);
  if (!built) return new Response('not found', { status: 404 });

  const sections = await loadContextSections();
  const text = await runRhaiWithContext({
    model: modelFor('suggest'),
    maxTokens: 2000,
    system: buildRhaiSystemPrompt(sections),
    userContent: [
      `Scan this client case and propose the next actions YOU should execute. You are the business partner handling this case with Rhea — think funnel stage, what they asked for, what's missing.`,
      ``,
      built.context,
      ``,
      `Rules:`,
      `- 3-5 actions, ranked by impact. Each must be executable by you (research, drafting, prep) — not "Rhea should call them".`,
      `- If the notes mention a solution the client wants (a WhatsApp briefing tool, truck tracking, etc.) → a research_solution action to spec it for the proposal. read_context("projects") and read_context("demos") to note if we've built the pattern before.`,
      `- Early-stage client → research_industry (their sector's ops reality, metrics that matter). Post-discovery → draft_proposal / prep_deck. Pre-session → draft_email.`,
      `- kind must be one of: research_industry | research_solution | draft_email | draft_proposal | prep_deck | other.`,
      ``,
      `After any tool use, return ONLY JSON: {"actions": [{"kind": "…", "title": "<short imperative>", "detail": "<what exactly you'll do + why now>"}]}`
    ].join('\n')
  });

  let parsed: { actions?: Array<{ kind?: string; title?: string; detail?: string }> };
  try {
    parsed = parseJsonLoose(text);
  } catch {
    return new Response('malformed scan — try again', { status: 502 });
  }

  const scan = {
    actions: (parsed.actions ?? [])
      .filter(a => a?.title && a?.detail)
      .slice(0, 5)
      .map((a, i) => ({
        id: `a${Date.now()}-${i}`,
        kind: VALID_KINDS.has(a.kind as LeadScanAction['kind']) ? (a.kind as LeadScanAction['kind']) : 'other',
        title: String(a.title).slice(0, 160),
        detail: String(a.detail).slice(0, 800)
      })),
    generatedAt: Date.now()
  };
  await adminDb().collection('workshopLeads').doc(id).set({ scan, updatedAt: Date.now() }, { merge: true });
  return Response.json({ scan });
}
