import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { modelFor } from './models';
import type { InterviewConfig, InterviewMessage, InterviewSession, InterviewSummary } from './types';

// Shared interview evaluation — used by the public interview endpoint (live, on
// completion or once the candidate is deep enough in) and by the operator
// backfill (catches interviews that got substantive but never hit the
// completion marker — abandoned tabs, or the model never emitting it).

// Once a candidate has answered this many questions, there's enough to give
// Rhea a useful read even if they never formally finish.
export const EVAL_MIN_TURNS = 8;

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return client;
}

export function countCandidateTurns(s: { messages: InterviewMessage[] }): number {
  return s.messages.filter(m => m.role === 'candidate').length;
}

/** A session deserves a summary if it completed OR got past the turn floor. */
export function needsSummary(s: InterviewSession): boolean {
  if (s.summary) return false;
  return s.status === 'completed' || countCandidateTurns(s) >= EVAL_MIN_TURNS;
}

export function verdictLabel(v: InterviewSummary['verdict']): string {
  return v === 'strong_fit' ? 'strong fit ✓' : v === 'possible' ? 'possible' : 'not a fit';
}

/** The Today-panel suggestion for a freshly-evaluated interview. */
export function buildInterviewSuggestion(
  config: InterviewConfig,
  session: InterviewSession,
  evaluated: { summary: InterviewSummary; questionsForRhea?: string },
  now: number
) {
  const completed = session.status === 'completed';
  return {
    kind: 'follow_up' as const,
    title: `Interview${completed ? '' : ' (unfinished)'}: ${session.candidate.name} — ${verdictLabel(evaluated.summary.verdict)}`,
    detail: `${evaluated.summary.summary}\n\nHard checks: ${evaluated.summary.hardCheckNotes}${
      evaluated.questionsForRhea ? `\n\nTheir questions for you: ${evaluated.questionsForRhea}` : ''
    }\n\nContact: ${session.candidate.email} · ${session.candidate.phone}. Full transcript on the Interviews tab.`,
    leadLabel: config.title,
    status: 'proposed' as const,
    createdAt: now,
    updatedAt: now
  };
}

/** Post-interview evaluation — the only place the internal rubric is used. */
export async function evaluateInterview(
  config: InterviewConfig,
  session: InterviewSession & { messages: InterviewMessage[] }
): Promise<{ summary: InterviewSummary; questionsForRhea?: string }> {
  const transcript = session.messages
    .map(m => `${m.role === 'rhai' ? 'RHAI' : 'CANDIDATE'}: ${m.text}`)
    .join('\n\n');

  const unfinished = session.status !== 'completed';

  const msg = await anthropic().messages.create({
    model: modelFor('suggest'),
    max_tokens: 1200,
    system:
      'You evaluate a screening-interview transcript against a hiring rubric for Rhea Karuturi. Be honest and decisive — a wrong "strong_fit" wastes her time. Judge communication quality from the transcript itself. Return ONLY JSON.',
    messages: [
      {
        role: 'user',
        content: [
          `ROLE: ${config.title}`,
          `RUBRIC:\n${config.criteria}`,
          `HARD CHECKS:\n${config.hardChecks.join('\n')}`,
          unfinished
            ? `\nNOTE: this interview was NOT formally completed — the candidate stopped partway. Evaluate on what's there; mark hard checks not yet covered as "unclear", and read fit from the answers given so far.`
            : '',
          ``,
          `TRANSCRIPT:\n${transcript.slice(0, 24_000)}`,
          ``,
          `Return ONLY JSON: {"verdict": "strong_fit"|"possible"|"not_a_fit", "summary": "<4-6 sentences: who they are, fit read, communication read>", "strengths": ["…"], "concerns": ["…"], "hardCheckNotes": "<one line per hard check: geography / availability / start date / duration — pass, fail, or unclear>", "questionsForRhea": "<their closing questions verbatim-ish, or empty string>"}`
        ].join('\n')
      }
    ]
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const raw = (fenced ? fenced[1] : text).trim();
  const parsed = JSON.parse(raw.slice(raw.search(/[{[]/))) as {
    verdict?: string;
    summary?: string;
    strengths?: string[];
    concerns?: string[];
    hardCheckNotes?: string;
    questionsForRhea?: string;
  };
  return {
    summary: {
      verdict: (['strong_fit', 'possible', 'not_a_fit'].includes(parsed.verdict ?? '')
        ? parsed.verdict
        : 'possible') as InterviewSummary['verdict'],
      summary: String(parsed.summary ?? '').slice(0, 1500),
      strengths: (parsed.strengths ?? []).map(s => String(s).slice(0, 200)).slice(0, 5),
      concerns: (parsed.concerns ?? []).map(s => String(s).slice(0, 200)).slice(0, 5),
      hardCheckNotes: String(parsed.hardCheckNotes ?? '').slice(0, 600)
    },
    questionsForRhea: parsed.questionsForRhea?.trim() ? String(parsed.questionsForRhea).slice(0, 1000) : undefined
  };
}
