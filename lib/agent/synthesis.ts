import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type {
  AxisPositionClaim,
  HardProblemClaim,
  OneLinerClaim
} from '@/lib/model/claims';
import { loadOntology } from '@/lib/ontology/loader';

/**
 * Synthesis is the "read deeper" content that expands next to the one-liner.
 * The one-liner is one striking sentence; the synthesis is 2–4 sentences
 * that elaborate without going into engine internals.
 *
 * Generated as a dedicated Sonnet pass against the live projection — same
 * pattern as graph-extract. Cheap, deterministic, and doesn't compete with
 * the main research stream for output budget.
 */

let client: Anthropic | null = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

const SYSTEM = `You write the "read deeper" synthesis for a structural diagnosis of a business. The user has already read a one-line distilled claim about their business at the top of the page; this is what expands when they click "read deeper."

# What this is

2–4 sentences that elaborate on the one-liner. Plain English. No jargon (no "newsvendor", "MTO/CODP/ATO/ETO", "perishable-inventory", "long-CCC", "vector", "load-bearing", "fill rate" — translate everything). The reader has spent 10 seconds with the one-liner; this is what they want next: the 30-second deeper read.

# What it must do

- Build on the one-liner, don't restate it. If the one-liner says X is hard, the synthesis says why X is hard for this specific company, what makes it harder, and what would change it.
- Stay specific to this company. Use facts and axis evidence to ground claims. If a competitor or festival or customer is named in the diagnosis, name them.
- Be honest about uncertainty. If something is a hypothesis, frame it as such ("the working assumption is...").
- Tie 2–3 axis positions together — the deeper read shows HOW the shape connects to the hard problem.

# What it must NOT do

- Recite the company category ("a B2B flower supply chain") — they know.
- Use ontology jargon (axes, positions, deviations, interactions, vectors).
- Make a "you should..." recommendation. Descriptive, never corrective.
- Exceed 5 sentences total. Tight is the point.

# Output

ONE JSON object on one line:
{"text":"<2-4 sentences>","lowConfidence":true|false}

Set lowConfidence:true and prefix the text with "Best current read, low confidence: " if the vector is sparse or contradictory.
No prose. No markdown. Just the JSON.`;

export interface SynthesisDraft {
  text: string;
  lowConfidence: boolean;
}

export async function generateSynthesis(opts: {
  oneLiner: OneLinerClaim | null;
  axisClaims: AxisPositionClaim[];
  hotProblems: HardProblemClaim[];
}): Promise<SynthesisDraft> {
  const { ontology } = loadOntology();

  const axisLines = opts.axisClaims
    .map(c => {
      const axis = ontology.axes.find(a => a.id === c.content.axisId);
      const plain = c.content.plainSummary ?? c.content.position;
      const dev = c.content.deviation
        ? ` [deviation: ${c.content.deviation.hotProblem}]`
        : '';
      return `- ${axis?.name ?? c.content.axisId}: ${plain}${dev}`;
    })
    .join('\n');

  const hotLines = opts.hotProblems
    .filter(h => !h.content.isDormant)
    .slice(0, 4)
    .map(h => {
      const firing = h.content.interactionFirings?.[0];
      const mech = firing?.mechanism ? ` (${firing.mechanism})` : '';
      return `- ${h.content.problemId}${mech}`;
    })
    .join('\n');

  const userMsg = [
    `# One-liner the reader has already seen`,
    opts.oneLiner?.content.sentence ?? '(none)',
    '',
    '# This company\'s axis vector (in plain English)',
    axisLines || '(none)',
    '',
    '# Top hot problems',
    hotLines || '(none)',
    '',
    'Write the synthesis per the system instructions. Return only the JSON.'
  ].join('\n');

  const res = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }]
  });

  const text = res.content
    .filter(b => b.type === 'text')
    .map(b => (b as { text: string }).text)
    .join('')
    .trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('synthesis agent did not return JSON');
  }
  const parsed = JSON.parse(text.slice(start, end + 1)) as {
    text?: string;
    lowConfidence?: boolean;
  };

  return {
    text: typeof parsed.text === 'string' ? parsed.text.trim().slice(0, 1200) : '',
    lowConfidence: parsed.lowConfidence === true
  };
}
