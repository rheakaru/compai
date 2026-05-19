import type { Provenance } from '@/lib/ontology/types';

export type Classification = 'translation' | 'judgement';
export type RoleStatus = 'pending' | 'started' | 'completed';

export interface RoleDoc {
  // Stored at companies/{companyId}/roles/{roleId}
  roleId: string;
  companyId: string;
  inviteToken: string;
  roleTitle: string;
  inviteeUid: string | null;          // backfilled if invitee signs in
  inviteeSessionId: string | null;
  inviteeEmail: string | null;
  status: RoleStatus;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  ontologyVersionHash: string;
}

export interface InviteIndexDoc {
  // Stored at inviteIndex/{token}
  token: string;
  companyId: string;
  roleId: string;
  createdAt: number;
}

export interface RoleEvidenceItem {
  source: string;
  quote: string;
  provenance: Provenance;
}

export interface RoleActivityContent {
  activity: string;
  classification: Classification;
  evidence: RoleEvidenceItem[];
}

export interface CareerStrategyContent {
  exposedSurface: string;          // the translation surface stated plainly
  judgementCore: string;           // what the role already does that grows
  movesTowardJudgement: string[];  // 3-5 concrete next moves
  aiInRoleTips: string[];          // 3-5 AI-in-your-role tips that accelerate the shift
  closingNote: string;             // one paragraph framing leverage + runway
}

export interface RoleActivityClaim {
  id: string;
  kind: 'role_activity';
  content: RoleActivityContent;
  provenance: Provenance;
  confidence: number;
  supersededBy: string | null;
  createdAt: number;
}

export interface CareerStrategyClaim {
  id: string;
  kind: 'career_strategy';
  content: CareerStrategyContent;
  provenance: Provenance;
  confidence: number;
  supersededBy: string | null;
  createdAt: number;
}

export type RoleClaim = RoleActivityClaim | CareerStrategyClaim;
