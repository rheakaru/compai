import type { ClaimKind, Provenance, AxisPosition } from '@/lib/ontology/types';

export interface BaseClaim {
  id: string;
  kind: ClaimKind;
  provenance: Provenance;
  confidence: number;
  supersededBy: string | null;
  createdAt: number;
}

export interface FactClaim extends BaseClaim {
  kind: 'fact';
  content: { statement: string; source?: string };
}

export interface AxisPositionClaim extends BaseClaim {
  kind: 'axis_position';
  content: AxisPosition;
}

export interface InteractionFiringRef {
  interactionId: string;
  axes: string[];
  mechanism: string;
  source: 'declared' | 'agent_hypothesis';
  strength: number;
}

export interface HardProblemClaim extends BaseClaim {
  kind: 'hard_problem';
  content: {
    problemId: string;
    weight: number;
    voterAxes: string[];
    // v2 source attribution — which of the three sources voted for this
    // problem and what each contributed. Each hot item carries this so the
    // UI can show "from interaction of customer_concentration + cash_conversion".
    sources?: Array<'position' | 'deviation' | 'interaction'>;
    breakdown?: {
      position: number;
      deviation: number;
      interaction: number;
    };
    interactionFirings?: InteractionFiringRef[];
    dominantAxisRank?: number;
    isDormant?: boolean;
  };
}

export interface AnalogyClaim extends BaseClaim {
  kind: 'analogy';
  content: {
    analogyId: string;
    matchScore: number;
    aboveFloor: boolean;
  };
}

export interface OneLinerClaim extends BaseClaim {
  kind: 'one_liner';
  content: { sentence: string; lowConfidence: boolean };
}

export type Claim =
  | FactClaim
  | AxisPositionClaim
  | HardProblemClaim
  | AnalogyClaim
  | OneLinerClaim;

export interface Correction {
  id: string;
  claimId: string;
  type: 'wrong_about_company' | 'wrong_about_reading';
  userNote: string;
  createdAt: number;
}

export interface OpenQuestion {
  id: string;
  axisRef: string;
  questionText: string;
  loadBearingRank: number;
  resolvedByClaimId: string | null;
}

export interface BrandingSnapshot {
  logoUrl: string | null;
  accentColor: string | null;
  name: string | null;
  description: string | null;
  extractedAt: number;
}

export interface CompanyDoc {
  ownerUid: string | null;
  sessionId: string | null;
  url: string;
  name: string | null;
  createdAt: number;
  // Set when the initial research stream finishes. Drives the
  // "you already analyzed this" dedup in /api/research — without this,
  // every paste of the same URL would re-run the agent.
  completedAt?: number | null;
  ontologyVersionHash: string;
  branding?: BrandingSnapshot | null;
}
