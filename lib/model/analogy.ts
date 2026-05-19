import type { AxisPositionClaim } from './claims';
import type { Ontology, AnalogyEntry } from '@/lib/ontology/types';
import { cosineSimilarity } from './projection';

export interface AnalogyMatch {
  entry: AnalogyEntry;
  score: number;
  aboveFloor: boolean;
}

export function matchAnalogy(
  axisClaims: AxisPositionClaim[],
  ontology: Ontology
): AnalogyMatch | null {
  if (ontology.analogy_library.length === 0) return null;

  const vector: Record<string, string> = {};
  for (const c of axisClaims) {
    if (c.content.confidence < 0.5) continue;
    vector[c.content.axisId] = c.content.position;
  }
  if (Object.keys(vector).length === 0) return null;

  let best: { entry: AnalogyEntry; score: number } | null = null;
  for (const entry of ontology.analogy_library) {
    const score = cosineSimilarity(vector, entry.signature);
    if (!best || score > best.score) best = { entry, score };
  }
  if (!best) return null;

  return {
    entry: best.entry,
    score: best.score,
    aboveFloor: best.score >= ontology.meta.analogy_floor
  };
}
