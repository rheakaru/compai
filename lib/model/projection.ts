import type {
  Claim,
  AxisPositionClaim,
  FactClaim,
  HardProblemClaim,
  AnalogyClaim,
  OneLinerClaim
} from './claims';
import type { Ontology, Axis, ConsequenceEntry, Provenance } from '@/lib/ontology/types';
import { detectDeclaredInteractions, type InteractionFiring } from './interactions';

export interface Profile {
  oneLiner: OneLinerClaim | null;
  axes: AxisPositionClaim[];
  facts: FactClaim[];
  hardProblems: HardProblemClaim[];
  analogies: AnalogyClaim[];
  deviations: AxisPositionClaim[];
  openQuestions: Array<{ axisId: string; question: string; rank: number }>;
}

function isTombstoned(c: Claim): boolean {
  const content = (c as { content?: { _tombstoned?: boolean } }).content;
  return content?._tombstoned === true;
}

export function projectFromClaims(allClaims: Claim[], ontology: Ontology): Profile {
  const live = allClaims.filter(c => c.supersededBy === null && !isTombstoned(c));

  const facts = live.filter((c): c is FactClaim => c.kind === 'fact');
  const axes = live.filter((c): c is AxisPositionClaim => c.kind === 'axis_position');
  const analogies = live.filter((c): c is AnalogyClaim => c.kind === 'analogy');
  const oneLiners = live.filter((c): c is OneLinerClaim => c.kind === 'one_liner');
  const oneLiner = oneLiners.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;

  const hardProblems = computeHotDormant({ axisClaims: axes, ontology });
  const deviations = collectDeviations(axes);
  const openQuestions = collectOpenQuestions(axes, ontology);

  return {
    oneLiner,
    axes,
    facts,
    hardProblems,
    analogies,
    deviations,
    openQuestions
  };
}

// ---------------------------------------------------------------------------
// CONSEQUENCE COMPUTATION v2 — three-source weighted blend.
//
// The v1 single-vote path is gone. Hot problems now blend three sources:
//   position    — static consequence.<value>.hot per axis (typical)
//   deviation   — atypical positions naming a hot problem
//   interaction — declared interactions[] + agent-surfaced pairs
//
// A strong position may outrank a weak interaction and vice versa — there
// is no fixed tiering. Each hot item records WHICH sources voted and which
// axes drove it so the UI can show attribution.
// ---------------------------------------------------------------------------

const BLEND_WEIGHT = { position: 1.0, deviation: 1.5, interaction: 1.8 };

interface ProblemAggregate {
  problemId: string;
  positionScore: number;
  deviationScore: number;
  interactionScore: number;
  voterAxes: Set<string>;
  drivingSources: Set<'position' | 'deviation' | 'interaction'>;
  interactionFirings: InteractionFiring[];
  // The axis whose load-bearing weight ends up dominating this problem.
  dominantAxisRank: number; // 1..9; 1 = most load-bearing
  provenanceMix: Set<Provenance>;
}

function makeAggregate(problemId: string): ProblemAggregate {
  return {
    problemId,
    positionScore: 0,
    deviationScore: 0,
    interactionScore: 0,
    voterAxes: new Set(),
    drivingSources: new Set(),
    interactionFirings: [],
    dominantAxisRank: 9,
    provenanceMix: new Set()
  };
}

function loadBearingWeight(rank: number): number {
  // Rank 1 → weight 9; rank 9 → weight 1.
  return Math.max(1, 10 - rank);
}

function resolveConsequenceEntry(axis: Axis, position: string): ConsequenceEntry | undefined {
  if (axis.consequence && axis.consequence[position]) return axis.consequence[position];
  if (axis.cells && axis.cells[position]) return axis.cells[position];
  return undefined;
}

export function computeHotDormant(opts: {
  axisClaims: AxisPositionClaim[];
  ontology: Ontology;
  agentInteractions?: InteractionFiring[];
}): HardProblemClaim[] {
  const { axisClaims, ontology } = opts;
  const aggregates = new Map<string, ProblemAggregate>();
  const dormantVoters = new Map<string, Set<string>>(); // problemId -> axes voting it dormant

  // --- SOURCE 1: POSITION ----------------------------------------------------
  // For each derived axis, contribute to the hot problems its position implies.
  for (const claim of axisClaims) {
    const axis = ontology.axes.find(a => a.id === claim.content.axisId);
    if (!axis) continue;
    const entry = resolveConsequenceEntry(axis, claim.content.position);
    if (!entry) continue;

    const lw = loadBearingWeight(axis.load_bearing_rank);
    const conf = Math.max(0.2, claim.content.confidence);

    for (const problemId of entry.hot ?? []) {
      const agg = aggregates.get(problemId) ?? makeAggregate(problemId);
      agg.positionScore += lw * conf;
      agg.voterAxes.add(axis.id);
      agg.drivingSources.add('position');
      agg.provenanceMix.add(claim.provenance);
      if (axis.load_bearing_rank < agg.dominantAxisRank) {
        agg.dominantAxisRank = axis.load_bearing_rank;
      }
      aggregates.set(problemId, agg);
    }
    for (const problemId of entry.dormant ?? []) {
      const s = dormantVoters.get(problemId) ?? new Set<string>();
      s.add(axis.id);
      dormantVoters.set(problemId, s);
    }
  }

  // --- SOURCE 2: DEVIATION ---------------------------------------------------
  // An axis with a `deviation` field names a hot problem and gives a magnitude.
  // The named problem may or may not overlap with the axis's static position
  // contribution; either way, it is a SEPARATE source with its own score.
  for (const claim of axisClaims) {
    const dev = claim.content.deviation;
    if (!dev || typeof dev.hotProblem !== 'string' || dev.hotProblem.trim() === '') continue;
    const axis = ontology.axes.find(a => a.id === claim.content.axisId);
    if (!axis) continue;
    const problemId = normaliseProblemId(dev.hotProblem);
    const lw = loadBearingWeight(axis.load_bearing_rank);
    const mag = Math.max(0, Math.min(1, dev.magnitude));
    const conf = Math.max(0.2, claim.content.confidence);

    const agg = aggregates.get(problemId) ?? makeAggregate(problemId);
    agg.deviationScore += lw * mag * conf;
    agg.voterAxes.add(axis.id);
    agg.drivingSources.add('deviation');
    agg.provenanceMix.add('agent_hypothesis');
    if (axis.load_bearing_rank < agg.dominantAxisRank) {
      agg.dominantAxisRank = axis.load_bearing_rank;
    }
    aggregates.set(problemId, agg);
  }

  // --- SOURCE 3: INTERACTION -------------------------------------------------
  // Declared priors (deterministic, matched on axis values) plus optional
  // agent-surfaced interactions (each carrying agent_hypothesis provenance).
  const declared = detectDeclaredInteractions(axisClaims, ontology);
  const agentSurfaced = opts.agentInteractions ?? [];
  const allFirings: InteractionFiring[] = [...declared, ...agentSurfaced];

  for (const firing of allFirings) {
    const problemId = normaliseProblemId(firing.hotProblem);
    // Max load-bearing weight across the involved axes.
    const ranks = firing.axes
      .map(a => ontology.axes.find(x => x.id === a)?.load_bearing_rank ?? 9);
    const maxLw = Math.max(...ranks.map(r => loadBearingWeight(r)));
    const minRank = Math.min(...ranks);

    const agg = aggregates.get(problemId) ?? makeAggregate(problemId);
    agg.interactionScore += maxLw * firing.strength;
    for (const ax of firing.axes) agg.voterAxes.add(ax);
    agg.drivingSources.add('interaction');
    agg.interactionFirings.push(firing);
    agg.provenanceMix.add(
      firing.source === 'declared' ? 'inferred_public' : 'agent_hypothesis'
    );
    if (minRank < agg.dominantAxisRank) agg.dominantAxisRank = minRank;
    aggregates.set(problemId, agg);
  }

  // --- DORMANT SUBTRACTION ---------------------------------------------------
  // If a problem ends up in any axis's dormant list AND has no deviation /
  // interaction backing it, drop it from hot. (Deviations and interactions
  // override the static dormant — they are signals that the company DOES face
  // this problem despite its base shape suggesting otherwise.)
  for (const problemId of dormantVoters.keys()) {
    const agg = aggregates.get(problemId);
    if (!agg) continue;
    if (agg.deviationScore === 0 && agg.interactionScore === 0) {
      aggregates.delete(problemId);
    }
  }

  // --- BLEND + MODULATE ------------------------------------------------------
  const ranked = [...aggregates.values()].map(agg => {
    const sourceBlend =
      BLEND_WEIGHT.position * agg.positionScore +
      BLEND_WEIGHT.deviation * agg.deviationScore +
      BLEND_WEIGHT.interaction * agg.interactionScore;
    // Modulate by inverse load-bearing rank of the dominant contributing axis.
    // (Both per-source scores ALREADY include load-weight, so this modulation
    // is a small bias toward problems whose dominant axis is high rank. Kept
    // moderate to keep "strong position can outrank weak interaction.")
    const modulation = 1 + (loadBearingWeight(agg.dominantAxisRank) - 1) * 0.04;
    const finalScore = sourceBlend * modulation;
    return { agg, finalScore };
  });

  ranked.sort((a, b) => b.finalScore - a.finalScore);

  const now = Date.now();
  const hot: HardProblemClaim[] = ranked.map(({ agg, finalScore }, i) => ({
    id: `derived_hot_${agg.problemId}_${now}_${i}`,
    kind: 'hard_problem',
    content: {
      problemId: agg.problemId,
      weight: Number(finalScore.toFixed(3)),
      voterAxes: [...agg.voterAxes],
      sources: [...agg.drivingSources],
      breakdown: {
        position: Number(agg.positionScore.toFixed(3)),
        deviation: Number(agg.deviationScore.toFixed(3)),
        interaction: Number(agg.interactionScore.toFixed(3))
      },
      interactionFirings: agg.interactionFirings.map(f => ({
        interactionId: f.interactionId,
        axes: f.axes,
        mechanism: f.mechanism,
        source: f.source,
        strength: Number(f.strength.toFixed(2))
      })),
      dominantAxisRank: agg.dominantAxisRank
    },
    provenance: agg.drivingSources.has('interaction')
      ? agg.interactionFirings.some(f => f.source === 'declared')
        ? 'inferred_public'
        : 'agent_hypothesis'
      : 'inferred_public',
    confidence: 0.7,
    supersededBy: null,
    createdAt: now
  }));

  const dormant: HardProblemClaim[] = [...dormantVoters.entries()]
    .filter(([problemId]) => !aggregates.has(problemId))
    .map(([problemId, voters], i) => ({
      id: `derived_dormant_${problemId}_${now}_${i}`,
      kind: 'hard_problem',
      content: {
        problemId,
        weight: 0,
        voterAxes: [...voters],
        sources: ['position'],
        isDormant: true
      },
      provenance: 'inferred_public',
      confidence: 0.7,
      supersededBy: null,
      createdAt: now
    }));

  return [...hot, ...dormant];
}

// Back-compat re-export. Existing callers use computeHardProblemMap.
export function computeHardProblemMap(
  axisClaims: AxisPositionClaim[],
  ontology: Ontology,
  agentInteractions: InteractionFiring[] = []
): HardProblemClaim[] {
  return computeHotDormant({ axisClaims, ontology, agentInteractions });
}

function normaliseProblemId(s: string): string {
  // Hot problems come from three sources with different naming conventions —
  // ontology snake_case ids (`scheduling`) and free-text agent strings
  // (`defending fill rate during demand spikes...`). We use a stable,
  // human-readable form: lowercased, whitespace-trimmed, capped at 200 chars.
  return s.trim().slice(0, 200);
}

function collectDeviations(axisClaims: AxisPositionClaim[]): AxisPositionClaim[] {
  return axisClaims.filter(c => {
    if (c.content.deviation && c.content.deviation.hotProblem) return true;
    const txt = (c.content.evidence ?? []).map(e => e.quote.toLowerCase()).join(' ');
    return txt.includes('deviat') || txt.includes('unusual') || txt.includes('atypical');
  });
}

function collectOpenQuestions(axisClaims: AxisPositionClaim[], ontology: Ontology) {
  const questions: Array<{ axisId: string; question: string; rank: number }> = [];
  for (const c of axisClaims) {
    if (c.content.confidence >= 0.6) continue;
    if (!c.content.disambiguatingQuestion) continue;
    const axis = ontology.axes.find(a => a.id === c.content.axisId);
    if (!axis) continue;
    questions.push({
      axisId: c.content.axisId,
      question: c.content.disambiguatingQuestion,
      rank: axis.load_bearing_rank
    });
  }
  return questions.sort((a, b) => a.rank - b.rank);
}

export function cosineSimilarity(a: Record<string, string>, b: Record<string, string>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let match = 0;
  let total = 0;
  for (const k of keys) {
    if (a[k] !== undefined && b[k] !== undefined) {
      total++;
      if (a[k] === b[k]) match++;
    }
  }
  if (total === 0) return 0;
  return match / total;
}
