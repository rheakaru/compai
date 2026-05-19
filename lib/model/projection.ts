import type {
  Claim,
  AxisPositionClaim,
  FactClaim,
  HardProblemClaim,
  AnalogyClaim,
  OneLinerClaim
} from './claims';
import type { Ontology, Axis, ConsequenceEntry } from '@/lib/ontology/types';

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

  const hardProblems = computeHardProblemMap(axes, ontology);
  const deviations = computeDeviations(axes, ontology);
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

export function computeHardProblemMap(
  axisClaims: AxisPositionClaim[],
  ontology: Ontology
): HardProblemClaim[] {
  const TOTAL_AXES = ontology.axes.length;
  const hotVotes = new Map<string, { weight: number; voters: Set<string> }>();
  const dormantVotes = new Map<string, Set<string>>();

  for (const claim of axisClaims) {
    const axis = ontology.axes.find(a => a.id === claim.content.axisId);
    if (!axis) continue;
    const entry = resolveConsequenceEntry(axis, claim.content.position);
    if (!entry) continue;

    const axisWeight = TOTAL_AXES + 1 - axis.load_bearing_rank;
    const confidenceWeight = Math.max(0.2, claim.content.confidence);
    const weight = axisWeight * confidenceWeight;

    for (const hot of entry.hot ?? []) {
      const cur = hotVotes.get(hot) ?? { weight: 0, voters: new Set<string>() };
      cur.weight += weight;
      cur.voters.add(axis.id);
      hotVotes.set(hot, cur);
    }
    for (const dormant of entry.dormant ?? []) {
      const s = dormantVotes.get(dormant) ?? new Set<string>();
      s.add(axis.id);
      dormantVotes.set(dormant, s);
    }
  }

  for (const dormantId of dormantVotes.keys()) {
    hotVotes.delete(dormantId);
  }

  const now = Date.now();
  const hot: HardProblemClaim[] = [...hotVotes.entries()]
    .sort((a, b) => b[1].weight - a[1].weight)
    .map(([problemId, v], i) => ({
      id: `derived_hot_${problemId}_${now}_${i}`,
      kind: 'hard_problem',
      content: {
        problemId,
        weight: Number(v.weight.toFixed(2)),
        voterAxes: [...v.voters]
      },
      provenance: 'inferred_public',
      confidence: 0.7,
      supersededBy: null,
      createdAt: now
    }));

  const dormant: HardProblemClaim[] = [...dormantVotes.entries()].map(([problemId, voters], i) => ({
    id: `derived_dormant_${problemId}_${now}_${i}`,
    kind: 'hard_problem',
    content: {
      problemId,
      weight: 0,
      voterAxes: [...voters],
      isDormant: true
    },
    provenance: 'inferred_public',
    confidence: 0.7,
    supersededBy: null,
    createdAt: now
  }));

  return [...hot, ...dormant];
}

function resolveConsequenceEntry(axis: Axis, position: string): ConsequenceEntry | undefined {
  if (axis.consequence && axis.consequence[position]) return axis.consequence[position];
  if (axis.cells && axis.cells[position]) return axis.cells[position];
  return undefined;
}

function computeDeviations(
  axisClaims: AxisPositionClaim[],
  ontology: Ontology
): AxisPositionClaim[] {
  return axisClaims
    .filter(c => c.content.confidence >= 0.5)
    .filter(c => {
      const axis = ontology.axes.find(a => a.id === c.content.axisId);
      if (!axis) return false;
      const note = (c.content.evidence ?? []).map(e => e.quote.toLowerCase()).join(' ');
      return note.includes('deviat') || note.includes('unusual') || note.includes('atypical');
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
