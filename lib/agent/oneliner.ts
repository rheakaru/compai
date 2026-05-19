import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { loadOntology } from '@/lib/ontology/loader';
import type { AxisPositionClaim, HardProblemClaim } from '@/lib/model/claims';

let client: Anthropic | null = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

const SYSTEM = `You generate ONE plain-English, striking sentence that distils a company's structural truth, computed from the position vector you are given.

The reader already knows what their company does. Don't recite the category. Don't throw jargon at them. The whole purpose of this line is to distil the complicated company into ONE simple thing they'll recognise the moment they read it — the "missing the forest for the trees" moment.

# Rules
- Plain English only. NO jargon: no "newsvendor", "MTO/CODP/ATO/ETO", "perishable-inventory", "long-CCC", "structural vector", "load-bearing", "fill rate".
- State the HARD PROBLEM in human terms, not in operations-research terms.
- Must be falsifiable.
- Like a smart friend's distilled take over coffee, not an analyst's report.
- Descriptive, never corrective — never imply they should be different.
- If the vector is too uncertain to claim something sharp, set lowConfidence:true and prefix with "Best current hypothesis, low confidence: ".

# GOOD examples
- "Your problem isn't growing flowers — it's predicting today's demand for something dead by tomorrow, when one missed festival can cost you a customer you can't replace."
- "You're built like a kitchen, not a factory: shared stations under time pressure, every day, with no slack to absorb a single bad week."
- "Selling to five customers means every order is half a relationship and half a margin call; running out is existential, overbuying is dead inventory."

# BAD examples — never emit
- "A B2B flower supply chain." (just the category)
- "A perishable-inventory business whose hard problem is demand forecasting under newsvendor economics." (jargon)
- "Structurally an MTO converter with concentrated customers and zero-slack working capital." (jargon)

# Output
ONE JSON object on one line:
{"sentence":"<one striking plain-English sentence>","lowConfidence":true|false}
Nothing else.`;

export async function regenerateOneLiner(opts: {
  axisClaims: AxisPositionClaim[];
  hotProblems: HardProblemClaim[];
}): Promise<{ sentence: string; lowConfidence: boolean }> {
  const { ontology } = loadOntology();

  const axisLines = opts.axisClaims
    .map(c => {
      const axis = ontology.axes.find(a => a.id === c.content.axisId);
      const conf = c.content.confidence.toFixed(2);
      return `${axis?.name ?? c.content.axisId} (rank ${axis?.load_bearing_rank ?? '?'}): ${c.content.position} [conf ${conf}]`;
    })
    .join('\n');

  const hotLines = opts.hotProblems
    .slice(0, 5)
    .map(c => `- ${c.content.problemId.replace(/_/g, ' ')} (weight ${c.content.weight.toFixed(1)})`)
    .join('\n');

  const message = `# Position vector\n${axisLines}\n\n# Top computed hard problems\n${hotLines || '(none yet — vector too sparse)'}`;

  const res = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system: SYSTEM,
    messages: [{ role: 'user', content: message }]
  });

  const text = res.content
    .filter(b => b.type === 'text')
    .map(b => (b as { text: string }).text)
    .join('')
    .trim();

  // Be tolerant: find the first JSON object in the response.
  const m = text.match(/\{[^{}]*"sentence"[^{}]*\}/);
  if (!m) {
    return { sentence: text.slice(0, 240), lowConfidence: true };
  }
  try {
    const parsed = JSON.parse(m[0]);
    return {
      sentence: typeof parsed.sentence === 'string' ? parsed.sentence : text.slice(0, 240),
      lowConfidence: parsed.lowConfidence === true
    };
  } catch {
    return { sentence: text.slice(0, 240), lowConfidence: true };
  }
}
