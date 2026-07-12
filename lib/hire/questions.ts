import 'server-only';
import { randomUUID } from 'crypto';
import type { HireQuestion, HireQuestionKind } from './types';

// Shared between the job-creation route and the collaborative chat route.
// Lives here (not in a route.ts) because Next.js route modules may only
// export HTTP handlers + config.

const KINDS: HireQuestionKind[] = ['logistics', 'experience', 'behavioral', 'role', 'culture', 'closing'];

export function sanitizeQuestions(list: Partial<HireQuestion>[]): HireQuestion[] {
  return list
    .map(q => ({
      id: typeof q.id === 'string' && q.id ? q.id.slice(0, 40) : randomUUID().slice(0, 8),
      text: String(q.text ?? '').trim().slice(0, 400),
      ...(q.purpose ? { purpose: String(q.purpose).slice(0, 300) } : {}),
      kind: (KINDS.includes(q.kind as HireQuestionKind) ? q.kind : 'experience') as HireQuestionKind
    }))
    .filter(q => q.text.length > 5)
    .slice(0, 25);
}

export const INTERVIEW_DESIGN_SYSTEM = [
  'You are an expert interview designer building a STRUCTURED first-round screening interview, following hiring best practice:',
  '- Structured beats unstructured: same core questions for every candidate, each tied to a competency from the JD.',
  '- Order: 1-2 quick logistics/screening checks first (availability, location/work-auth if the JD implies it), then experience & skills, then 3-4 behavioral questions (past behaviour, "tell me about a time…", STAR-answerable), then 1-2 role-specific scenario questions, then culture & motivation, then one closing question inviting THEIR questions.',
  '- 10-14 questions total. Conversational phrasing, one thing per question, no compound questions, no leading questions.',
  '- NEVER ask about protected characteristics or anything legally risky: age, religion, caste, marital/family status, pregnancy, health/disability, ethnicity, politics. Keep every question job-relevant.',
  '- Each question gets a one-line "purpose" so the hiring team knows what signal it produces.',
  'Return ONLY JSON when asked.'
].join('\n');
