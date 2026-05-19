import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { loadOntology } from '@/lib/ontology/loader';
import type {
  AxisPositionClaim,
  HardProblemClaim,
  OneLinerClaim
} from '@/lib/model/claims';
import type { FiveProjects } from './projects';
import type { CompanyStack } from '@/lib/model/stack';

let client: Anthropic | null = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface SessionPlanBeat {
  beat: string;                 // matches session_arc[].beat
  beatHeading: string;          // constant, from session_arc (the same on every plan)
  beatSourceLine: string;       // constant, the from_deck/from_playbook source line
  inhabited: string;            // company-specific content under the constant heading
  references: string[];         // axis ids / fact references that ground this beat
}

export interface SessionPlanContent {
  beats: SessionPlanBeat[];
  closingSpine: {
    diagnosisUnderstanding: string; // what they already got — the free diagnosis
    sessionBuilding: string;        // what the session adds — building on top
    irreducibleHuman: string;       // why the senior person is non-negotiable
  };
  // Notes from the agent about which company-specific elements drove the plan.
  drivers: string[];
}

const SYSTEM = `You generate the SESSION PLAN — the 4th and final node in compAI's chain (shape → hard problem → transferable solutions → 5 projects → THIS).

This is "what one day with Rhea turns those 5 projects into," rendered as a company-specific itinerary using a FIXED session arc.

# The shape of the hybrid (this is the entire point)

The session ARC is CONSTANT. Every company gets the same six beats. State this to the prospect — do not hide it. The fixed arc is a strength: it says "this is a proven format," not "this is improvised." A bespoke arc would be a lie.

But every beat is INHABITED by THIS company's diagnosis. The frame is constant; what fills each beat is theirs — their anchor project, their source-of-truth file, their likely-skeptic role, their data nouns.

A constant frame, specifically inhabited. Like a sonnet: fixed form, not a generic poem.

# What MUST NOT happen

- Do NOT build "a generic deck with one personalized slide." A template with a single mail-merge field is the failure mode — the seam shows and it converts worse than either extreme.
- Do NOT invent beats outside the session_arc. The arc is the moat; it grew from real sessions.
- Do NOT contradict the sessions.html facts:
  - ₹1 lakh/day
  - Same-day payment
  - One senior person (Rhea) is non-negotiable
  - Bangalore or San Francisco only
- Do NOT promise outcomes the diagnosis does not support.

Test: the arc headings must be identical across companies; the content under every heading must change materially when the company changes. If only one beat is company-specific, that is the mail-merge failure — wrong.

# The closing spine

End on this exact frame:
- The free diagnosis gave them UNDERSTANDING.
- The session is where they BUILD on top of that understanding.
- The one thing that cannot be outsourced is the SENIOR PERSON in the room.

Tie all three. This is also the single non-negotiable on sessions.html.

# Output format

Output ONE JSON object on one line. No prose, no markdown, no fences. Keys:

{
  "beats": [
    {
      "beat": "<beat id from session_arc>",
      "inhabited": "<2-3 sentences that fill this constant beat with THIS company's specifics — name the anchor project, the source-of-truth file, the data nouns, the likely skeptic role, etc., as appropriate to the beat>",
      "references": ["<axis_id or 'anchor_project' or 'source_of_truth' that grounds this beat>", "..."]
    },
    ...
  ],
  "closingSpine": {
    "diagnosisUnderstanding": "<one sentence stating what the prospect already understood from the free diagnosis>",
    "sessionBuilding": "<one sentence on what the session adds — concrete, references the anchor project>",
    "irreducibleHuman": "<one sentence on why the senior person specifically matters for THIS company's hard problem>"
  },
  "drivers": ["<short note: which axis/deviation/interaction made this plan look the way it does>", "..."]
}
`;

export async function generateSessionPlan(opts: {
  oneLiner: OneLinerClaim | null;
  axisClaims: AxisPositionClaim[];
  hotProblems: HardProblemClaim[];
  projects: FiveProjects;
  stack: CompanyStack | null;
  sourceOfTruthDocs: Array<{ name: string; mentionCount: number }>;
  firedInteractions: Array<{ id: string; hotProblem: string; predicts?: string }>;
}): Promise<SessionPlanContent> {
  const { ontology } = loadOntology();
  const projection = ontology.session_projection;
  if (!projection) {
    throw new Error('ontology.session_projection missing');
  }

  const axisLines = opts.axisClaims
    .map(c => {
      const axis = ontology.axes.find(a => a.id === c.content.axisId);
      const dev = c.content.deviation
        ? ` [deviation: ${c.content.deviation.hotProblem}]`
        : '';
      return `- ${axis?.name ?? c.content.axisId}: ${c.content.position} (conf ${c.content.confidence.toFixed(2)})${dev}`;
    })
    .join('\n');

  const hotLines = opts.hotProblems
    .filter(c => !c.content.isDormant)
    .slice(0, 6)
    .map(c => `- ${c.content.problemId} (sources: ${(c.content.sources ?? []).join('+')})`)
    .join('\n');

  const projectsBlock = [
    `## Anchor project (this is the SINGLE most important input to beat 1)`,
    `Title: ${opts.projects.anchor.title}`,
    `Artifact: ${opts.projects.anchor.artifact}`,
    `Function: ${opts.projects.anchor.businessFunction}`,
    `Rationale: ${opts.projects.anchor.rationale}`,
    `Connectors: ${opts.projects.anchor.connectors.join(', ') || 'none named'}`,
    ``,
    `## Supporting projects`,
    ...opts.projects.supporting.map((p, i) => `${i + 1}. ${p.title} — ${p.artifact} (${p.businessFunction})`),
    ``,
    `## Synthesis`,
    opts.projects.synthesis
  ].join('\n');

  const docsBlock =
    opts.sourceOfTruthDocs.length > 0
      ? `Source-of-truth files the company runs on (operating spine):\n${opts.sourceOfTruthDocs.map(d => `- ${d.name}${d.mentionCount > 1 ? ` (named by ${d.mentionCount} roles)` : ''}`).join('\n')}`
      : `No source-of-truth files have been named yet. For beat 2 (source_of_truth_ritual), NAME the file this company most likely runs on given its shape (be specific — "the ${stackHint(opts.stack)} spreadsheet your ops lead keeps" beats "a file"). Flag this guess in the references with "source_of_truth_inferred".`;

  const stackBlock = opts.stack
    ? `ERP=${opts.stack.erp || 'none'}, accounting=${opts.stack.accounting || 'none'}, suite=${opts.stack.suite}${opts.stack.suite === 'other' ? ` (${opts.stack.suiteOther})` : ''}`
    : 'no declared stack';

  const interactionsBlock =
    opts.firedInteractions.length > 0
      ? `Firing interactions (and what they predict about session framing):\n${opts.firedInteractions.map(i => `- ${i.id}: ${i.predicts ?? i.hotProblem}`).join('\n')}`
      : 'no declared interactions firing';

  const arcBlock = projection.session_arc
    .map(b => `- beat="${b.beat}" | heading source: "${b.from_deck ?? b.from_playbook ?? b.from_deck_and_offer ?? ''}" | project_from: ${b.project_from}`)
    .join('\n');

  const user = [
    `# The session arc (CONSTANT — same for every company)`,
    arcBlock,
    `\n# Closing spine guidance`,
    projection.closing_spine,
    `\n# This company's one-liner`,
    opts.oneLiner?.content.sentence ?? '(no one-liner yet)',
    `\n# This company's axes`,
    axisLines,
    `\n# Top hot problems`,
    hotLines,
    `\n# Firing interactions`,
    interactionsBlock,
    `\n# Stack`,
    stackBlock,
    `\n# Operating spine`,
    docsBlock,
    `\n# 5-projects already shown to the prospect`,
    projectsBlock,
    `\nGenerate the SessionPlanContent JSON per the system instructions. Inhabit EVERY beat with company-specifics — never use a generic line. The closing spine must tie all three frames (understanding / building / senior person) to THIS company's hard problem.`
  ].join('\n');

  const res = await getClient().messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 2500,
    system: SYSTEM,
    messages: [{ role: 'user', content: user }]
  });

  const text = res.content
    .filter(b => b.type === 'text')
    .map(b => (b as { text: string }).text)
    .join('')
    .trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('session-plan agent did not return JSON');
  }
  const parsed = JSON.parse(text.slice(start, end + 1)) as {
    beats: Array<{ beat: string; inhabited: string; references?: string[] }>;
    closingSpine: SessionPlanContent['closingSpine'];
    drivers?: string[];
  };

  // Stitch the constant headings back in from the ontology — the agent only
  // emits the inhabited content. This enforces that beat ids/order/headings
  // are byte-identical across companies.
  const beatById = new Map(projection.session_arc.map(b => [b.beat, b]));
  const stitched: SessionPlanBeat[] = projection.session_arc.map(arcBeat => {
    const agentBeat = parsed.beats.find(b => b.beat === arcBeat.beat);
    const sourceLine =
      arcBeat.from_deck ?? arcBeat.from_playbook ?? arcBeat.from_deck_and_offer ?? '';
    return {
      beat: arcBeat.beat,
      beatHeading: headingFromBeatId(arcBeat.beat),
      beatSourceLine: sourceLine,
      inhabited: agentBeat?.inhabited?.trim() ??
        '(the agent did not return content for this beat — refresh to retry)',
      references: agentBeat?.references ?? []
    };
  });
  if (beatById.size !== stitched.length) {
    throw new Error('session arc / agent beats mismatch');
  }

  return {
    beats: stitched,
    closingSpine: parsed.closingSpine,
    drivers: parsed.drivers ?? []
  };
}

function headingFromBeatId(beat: string): string {
  switch (beat) {
    case 'scope_one_build':
      return 'One working build by 5pm — not a strategy deck';
    case 'source_of_truth_ritual':
      return 'The file you all already run on';
    case 'value_in_first_hour':
      return 'Something working in your hands inside the first hour';
    case 'five_stage_dashboard':
      return 'Input · View · Analyse · Insight · Action';
    case 'skeptic_turn':
      return 'The skeptic who runs over time';
    case 'ownership_close':
      return 'On your machine, your keys, no vendor';
    default:
      return beat.replace(/_/g, ' ');
  }
}

function stackHint(stack: CompanyStack | null): string {
  if (!stack) return 'Excel';
  if (stack.erp && stack.erp.toLowerCase() !== 'none') return stack.erp;
  if (stack.accounting && stack.accounting.toLowerCase() !== 'none') return stack.accounting;
  if (stack.suite === 'google_workspace') return 'Sheets';
  if (stack.suite === 'microsoft_365') return 'Excel';
  if (stack.suite === 'zoho') return 'Zoho';
  return 'Excel';
}
