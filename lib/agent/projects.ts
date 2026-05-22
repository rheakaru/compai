import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { loadOntology } from '@/lib/ontology/loader';
import type { AxisPositionClaim, HardProblemClaim, OneLinerClaim } from '@/lib/model/claims';
import type { CompanyStack } from '@/lib/model/stack';
import type { AnalogyEntry, Interaction } from '@/lib/ontology/types';

let client: Anthropic | null = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

const SYSTEM = `You generate the FIVE AI-projects output for Throughline. This is the Gate 2 payoff: it earns the meeting or does not. Read every rule.

# What you are producing

A JSON object with exactly five entries:
- 1 anchor project: the SINGLE highest-leverage intervention for this shape. Named with a concrete artifact a user can picture running on their stack. This is the conversion-bearing item.
- 3 supporting projects: credible portfolio breadth. Each names a concrete artifact and the business function it touches. Each must be feasible on the declared stack.
- 1 SYNTHESIS — NOT a sixth project. The synthesis is "what we learned about your business" — the non-obvious structural read stated plainly. Projects show competence; synthesis shows insight. Do not dilute the synthesis into a sixth project.

# The hard constraints

- Every project depends on, and is feasible against, the user's declared stack (ERP, accounting, suite). If a project needs an internal tool, name the CONNECTOR required (e.g. "needs Zoho Books → Slack webhook").
- Stack-aware credibility is the entire conversion mechanism. Generic AI suggestions destroy it. If you cannot name a real connector for the declared stack, prefer a different project.
- Descriptive, never corrective. Do not tell the company it is positioned wrong.
- No fabrication. If the position vector and stack make a project class infeasible, omit it rather than invent.

# Source-of-truth files take priority over generic stack tools

When the user has named source-of-truth documents (the files coworkers said they can't do their job without), THOSE are the concrete artifacts your projects must target. A project that "absorbs ProductionTracker.xlsx and outperforms it" beats a project that "uses a generic AI agent" — every time. The named file IS where the leverage is.

# When variety × traceability fires — bespoke beats platform

When the interaction "variety_x_regulatory_traceability" is firing (you'll see it in the input below), it predicts off-the-shelf ERP rejection. Bespoke owned AI tooling that ABSORBS the existing source-of-truth file and OUTPERFORMS it beats adopting another rigid platform. Frame the anchor project accordingly: "absorb your existing file" rather than "adopt a new tool." Do NOT suggest replacing the spreadsheet with a SaaS product.

# Output format

ONE JSON object on one line, no prose around it:

{
  "anchor": { "title": "...", "artifact": "...", "businessFunction": "...", "rationale": "<one sentence tying it to the hard problem>", "connectors": ["..."] },
  "supporting": [
    { "title": "...", "artifact": "...", "businessFunction": "...", "rationale": "...", "connectors": ["..."] },
    { "title": "...", "artifact": "...", "businessFunction": "...", "rationale": "...", "connectors": ["..."] },
    { "title": "...", "artifact": "...", "businessFunction": "...", "rationale": "...", "connectors": ["..."] }
  ],
  "synthesis": "<one sharp paragraph stating the non-obvious structural read>"
}
`;

export interface FiveProjects {
  anchor: ProjectCard;
  supporting: ProjectCard[];
  synthesis: string;
}
export interface ProjectCard {
  title: string;
  artifact: string;
  businessFunction: string;
  rationale: string;
  connectors: string[];
}

export async function generateFiveProjects(opts: {
  oneLiner: OneLinerClaim | null;
  axisClaims: AxisPositionClaim[];
  hotProblems: HardProblemClaim[];
  stack: CompanyStack;
  analogy: { entry: AnalogyEntry; score: number; aboveFloor: boolean } | null;
  sourceOfTruthDocs?: Array<{ name: string; mentionCount: number }>;
  firedInteractions?: Array<{ id: string; hotProblem: string; predicts?: string }>;
}): Promise<FiveProjects> {
  const { ontology } = loadOntology();

  const axisLines = opts.axisClaims
    .map(c => {
      const axis = ontology.axes.find(a => a.id === c.content.axisId);
      return `- ${axis?.name ?? c.content.axisId} (rank ${axis?.load_bearing_rank ?? '?'}): ${c.content.position} [conf ${c.content.confidence.toFixed(2)}]`;
    })
    .join('\n');
  const hotLines = opts.hotProblems
    .slice(0, 8)
    .map(c => `- ${c.content.problemId.replace(/_/g, ' ')} (weight ${c.content.weight.toFixed(1)})`)
    .join('\n');

  const stackBlock = [
    `ERP: ${opts.stack.erp || 'none'}`,
    `Accounting: ${opts.stack.accounting || 'none'}`,
    `Suite: ${opts.stack.suite}${opts.stack.suite === 'other' ? ` (${opts.stack.suiteOther})` : ''}`,
    `Other tools: ${opts.stack.notes || 'none'}`,
    `Extra detail: ${opts.stack.extraDetail || 'none'}`
  ].join('\n');

  const analogyBlock = opts.analogy && opts.analogy.aboveFloor
    ? `Solved-domain anchor (above floor): ${opts.analogy.entry.solved_domains.map(d => d.domain).join('; ')}.\nResidue (the actual project): ${opts.analogy.entry.residue}\nPosture-shift: ${opts.analogy.entry.posture_shift}`
    : 'No analogy above the quality floor — design projects from the shape and hard-problem map directly.';

  const docs = opts.sourceOfTruthDocs ?? [];
  const docBlock = docs.length > 0
    ? `These are the files coworkers at this company said they can't do their job without — the operating spine:\n${docs
        .map(d => `- ${d.name}${d.mentionCount > 1 ? ` (named by ${d.mentionCount} roles)` : ''}`)
        .join('\n')}\n\nYour projects must target THESE artifacts. Phrase the anchor as "absorb [the named file] and outperform it" — not "use a generic agent."`
    : 'No source-of-truth files captured (no roles invited or no docs named).';

  const interactionBlock = (opts.firedInteractions ?? [])
    .filter(i => i.predicts)
    .map(i => `- ${i.id}: ${i.predicts}`)
    .join('\n');
  const interactionFraming = interactionBlock
    ? `# Firing interactions and their transferable predictions\n${interactionBlock}`
    : '# Firing interactions\n(none with transferable predictions)';

  const user = [
    `# One-liner\n${opts.oneLiner?.content.sentence ?? '(none)'}`,
    `# Axis vector\n${axisLines}`,
    `# Top hot problems\n${hotLines}`,
    `# Declared stack\n${stackBlock}`,
    `# Source-of-truth files (highest-priority concrete artifacts)\n${docBlock}`,
    interactionFraming,
    `# Analogy context\n${analogyBlock}`
  ].join('\n\n');

  const res = await getClient().messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{ role: 'user', content: user }]
  });

  const text = res.content
    .filter(b => b.type === 'text')
    .map(b => (b as { text: string }).text)
    .join('')
    .trim();

  // Find the first balanced JSON object.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('5-projects agent did not return JSON');
  }
  const parsed = JSON.parse(text.slice(start, end + 1)) as FiveProjects;
  return parsed;
}
