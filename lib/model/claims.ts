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

export interface HardProblemClaim extends BaseClaim {
  kind: 'hard_problem';
  content: { problemId: string; weight: number; voterAxes: string[]; isDormant?: boolean };
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

export interface CompanyDoc {
  ownerUid: string | null;
  sessionId: string | null;
  url: string;
  name: string | null;
  createdAt: number;
  ontologyVersionHash: string;
}
