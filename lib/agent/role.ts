import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { loadOntology } from '@/lib/ontology/loader';
import type {
  Classification,
  CareerStrategyContent,
  RoleEvidenceItem
} from '@/lib/model/role';

let client: Anthropic | null = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

export type RoleEvent =
  | {
      type: 'activity';
      activity: string;
      classification: Classification;
      evidence: RoleEvidenceItem[];
      confidence: number;
    }
  | { type: 'career_strategy'; strategy: CareerStrategyContent }
  | { type: 'done' }
  | { type: 'error'; message: string };

function buildSystemPrompt(): string {
  const { ontology } = loadOntology();
  const t = ontology.role_split.translation;
  const j = ontology.role_split.judgement;
  const phil = ontology.role_split.philosophy;
  const deliverable = ontology.role_split.invitee_deliverable;
  const trust = ontology.role_split.trust_invariant;
  const elicit = ontology.role_split.primary_elicitation;

  const elicitBlock = elicit
    ? `
# Primary elicitation — the source-of-truth document is the highest-weighted input

The user is asked first: "${elicit.question}"
${elicit.rationale}

Weight: ${elicit.weight}. The named document is more informative than any paragraph of self-description.

Invitee framing: ${elicit.invitee_framing}

When the user has named a source-of-truth document:
- Treat it as the role's center of gravity. The role's activities orbit it.
- In your career strategy, EXPLICITLY reference the file by name. Tell them what it actually is in their work and why it matters — name it once early, then once again in the AI-in-role section.
- Your AI-in-role tips must aim to OUTPERFORM that specific file, not replace it with a generic tool. Phrase the tips as "absorb [the file] and beat it at X" rather than "use [generic AI tool]."
- If they did NOT name a document, gently note the absence in the closing note ("it's worth finding the one document you actually live in") without making it a verdict.
`
    : '';

  return `You analyze a person's description of their job and produce two outputs in sequence:

1. A list of distinct ACTIVITIES they perform, each classified as TRANSLATION or JUDGEMENT, with the quote from their description as evidence.
2. A CAREER STRATEGY for them — their primary deliverable.

# The translation / judgement split

## Translation work (collapses into the agents layer — the exposed surface)
${t.definition}
Signals: ${t.signals.join(', ')}

## Judgement work (grows, dramatically)
${j.definition}
Signals: ${j.signals.join(', ')}

# Philosophy
${phil}
${elicitBlock}
# The career strategy (PRIMARY DELIVERABLE)
${deliverable}

# Trust invariant (non-negotiable)
${trust}

# Concrete rules

- Be DESCRIPTIVE, never corrective. Never tell the person they are doing the wrong work.
- The exposed (translation) surface MUST be stated plainly. Hiding it reads as evasive and kills trust. It is the honest setup that makes the career strategy meaningful.
- The career strategy makes honest self-description self-interested: an inflated "all judgement" yields a useless strategy; an honest one yields a real one. The directional strategy IS the incentive mechanism.
- Concrete next moves: name 3–5 specific things this person can start doing this week or this month — not generic "develop leadership skills."
- AI-in-role tips: 3–5 specific ways AI can take the translation surface OFF their plate so they have more bandwidth for judgement. Reference the kind of tools/agents that fit their stated role.
- Closing note: one short paragraph framing this as leverage + runway, never as a verdict.

# Output format

Stream NDJSON. One JSON object per line. No prose around them, no markdown.

For each distinct activity (typically 4–8 per role), emit:
{"type":"activity","activity":"<short noun phrase: what they actually do>","classification":"translation"|"judgement","evidence":[{"source":"role_description","quote":"<short quote from their text>","provenance":"user_provided"}],"confidence":0.0-1.0}

After all activities, emit ONE career_strategy object:
{"type":"career_strategy","strategy":{"exposedSurface":"<one sentence stating the translation surface plainly>","judgementCore":"<one sentence on what they already do that grows>","movesTowardJudgement":["<concrete move 1>","<move 2>","<move 3>","..."],"aiInRoleTips":["<tip 1>","<tip 2>","<tip 3>","..."],"closingNote":"<one short paragraph: leverage + runway, never a verdict>","sourceOfTruthAnchor":"<one sentence naming the file AND stating where its leverage is; null if no file named>"}}

# What NOT to do

- Do not output any prose outside NDJSON lines.
- Do not fabricate activities that are not supported by the role description. Skip rather than invent.
- Do not output more than 10 activity lines.
- Do not classify an activity as judgement just because the person clearly wants it to be. Follow the evidence in their description.
- Do not produce a verdict ("your role will be automated"). The strategy is leverage + runway.`;
}

export async function* streamRoleDerivation(opts: {
  roleTitle: string;
  description: string;
  sourceOfTruthDoc?: string | null;
  companyContext?: string;
}): AsyncGenerator<RoleEvent> {
  const system = buildSystemPrompt();
  const docBlock = opts.sourceOfTruthDoc?.trim()
    ? `# THE FILE THEY CAN'T WORK WITHOUT (primary input — weight this above the free text)\n${opts.sourceOfTruthDoc.trim()}\n\nThis named file is the role's center of gravity. Reference it explicitly in the career strategy. Frame the AI tips as outperforming THIS file specifically, not replacing it with generic tools.`
    : `# THE FILE THEY CAN'T WORK WITHOUT\n(They did not name one. Note this gently in the closing — it's worth finding the one document they actually live in.)`;
  const message = [
    `# Role title\n${opts.roleTitle}`,
    opts.companyContext ? `# Company context\n${opts.companyContext}` : null,
    docBlock,
    `# Their description of the role\n${opts.description}`,
    `\nClassify the distinct activities and produce their career strategy per the system instructions.`
  ]
    .filter(Boolean)
    .join('\n\n');

  let buffer = '';
  const flush = function* (): Generator<RoleEvent> {
    let nl: number;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (obj && typeof obj === 'object' && 'type' in obj) {
          yield obj as RoleEvent;
        }
      } catch {
        // partial — wait for more
      }
    }
  };

  try {
    const stream = await getClient().messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: message }]
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        buffer += event.delta.text;
        for (const e of flush()) yield e;
      }
    }
    if (buffer.trim()) {
      try {
        const obj = JSON.parse(buffer.trim());
        if (obj && typeof obj === 'object' && 'type' in obj) yield obj as RoleEvent;
      } catch {
        // ignore tail
      }
    }
    yield { type: 'done' };
  } catch (err) {
    yield { type: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
