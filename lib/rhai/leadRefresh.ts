import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import {
  buildRhaiSystemPrompt,
  loadContextSections,
  parseJsonLoose,
  runRhaiWithContext
} from './server';
import { buildLeadContext } from './leadContext';
import { modelFor } from './models';
import type { LeadScan, LeadScanAction, LeadUnderstanding } from '@/lib/leads/types';

// Shared core of the understand + scan passes. The API routes
// (app/api/leads/[id]/understand and .../scan) and the Fireflies ingestion
// pipeline (lib/rhai/fireflies.ts) all call these — one copy of the prompt
// logic, multiple entry points.

const VALID_SCAN_KINDS = new Set<LeadScanAction['kind']>([
  'research_industry',
  'research_solution',
  'draft_email',
  'draft_proposal',
  'prep_deck',
  'other'
]);

/**
 * Rebuild Rhai's understanding of a client from all note sessions and persist
 * it on the lead. Returns null if the lead doesn't exist; throws on a
 * malformed model reply (routes translate that into a 502).
 */
export async function refreshLeadUnderstanding(leadId: string): Promise<LeadUnderstanding | null> {
  const built = await buildLeadContext(leadId);
  if (!built) return null;

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

  const parsed = parseJsonLoose<{ summary?: string; bullets?: string[] }>(text);
  const understanding: LeadUnderstanding = {
    summary: String(parsed.summary ?? '').slice(0, 1200),
    bullets: (parsed.bullets ?? []).slice(0, 5).map(b => String(b).slice(0, 300)),
    updatedAt: Date.now()
  };
  await adminDb()
    .collection('workshopLeads')
    .doc(leadId)
    .set({ understanding, updatedAt: Date.now() }, { merge: true });
  return understanding;
}

/**
 * The client scan — Rhai proposes executable next actions for this case.
 * Persisted on the lead. Returns null if the lead doesn't exist; throws on a
 * malformed model reply.
 */
export async function refreshLeadScan(leadId: string): Promise<LeadScan | null> {
  const built = await buildLeadContext(leadId);
  if (!built) return null;

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

  const parsed = parseJsonLoose<{ actions?: Array<{ kind?: string; title?: string; detail?: string }> }>(
    text
  );
  const scan: LeadScan = {
    actions: (parsed.actions ?? [])
      .filter(a => a?.title && a?.detail)
      .slice(0, 5)
      .map((a, i) => ({
        id: `a${Date.now()}-${i}`,
        kind: VALID_SCAN_KINDS.has(a.kind as LeadScanAction['kind'])
          ? (a.kind as LeadScanAction['kind'])
          : 'other',
        title: String(a.title).slice(0, 160),
        detail: String(a.detail).slice(0, 800)
      })),
    generatedAt: Date.now()
  };
  await adminDb()
    .collection('workshopLeads')
    .doc(leadId)
    .set({ scan, updatedAt: Date.now() }, { merge: true });
  return scan;
}
