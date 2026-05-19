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

const SYSTEM = `You generate ONE sentence that states the non-obvious structural claim about a business, computed from the position vector you are given.

# Rules
- State the HARD PROBLEM, not the product category.
- Must be falsifiable.
- BAD: "A B2B flower supply chain."
- GOOD: "A perishable-inventory business whose hard problem is demand forecasting under newsvendor economics, not production."
- If the vector is too uncertain to claim something sharp, set lowConfidence:true and prefix the sentence with "Best current hypothesis, low confidence: ".
- Descriptive, never corrective — never imply they should be different.

# Output
Output ONLY one JSON object on one line:
{"sentence":"<one sentence>","lowConfidence":true|false}
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
