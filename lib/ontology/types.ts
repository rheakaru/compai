export type Provenance =
  | 'found_on_site'
  | 'inferred_public'
  | 'agent_hypothesis'
  | 'user_provided';

export type CorrectionType = 'wrong_about_company' | 'wrong_about_reading';

export type ClaimKind =
  | 'fact'
  | 'axis_position'
  | 'hard_problem'
  | 'analogy'
  | 'one_liner';

export type AxisType = 'categorical' | 'spectrum' | 'categorical_2x2';

export interface ConsequenceEntry {
  hot?: string[];
  dormant?: string[];
  strategic_lever?: string;
}

export interface Axis {
  id: string;
  name: string;
  load_bearing_rank: number;
  type: AxisType;
  values?: string[];
  endpoints?: Record<string, string>;
  archetypes?: string[];
  bands?: string[];
  cells?: Record<string, ConsequenceEntry>;
  middle?: string;
  components?: string[];
  categorical_break?: string;
  derive_from: string[];
  consequence?: Record<string, ConsequenceEntry>;
  note?: string;
  transfer_note?: string;
}

export interface AnalogySolvedDomain {
  domain: string;
  transfers: string;
}

export interface AnalogyEntry {
  id: string;
  signature: Record<string, string>;
  solved_domains: AnalogySolvedDomain[];
  residue: string;
  posture_shift: string;
}

export interface Interaction {
  id: string;
  axes: string[];
  fires_when: string;
  compounding_mechanism: string;
  hot_problem: string;
  seen_in?: string;
  // When the interaction fires, this is the transferable prediction it
  // carries. Used by the 5-projects generator to shift framing.
  predicts?: string;
}

export interface ConsequenceRulesV2 {
  method: string;
  sources: Record<string, { input: string; score: string }>;
  blend: string;
  load_bearing_modulation: string;
  dormant_subtraction: boolean;
  output: string;
  invariant: string;
}

export interface PrimaryElicitation {
  question: string;
  rationale: string;
  weight: string;
  invitee_framing: string;
  aggregate_use: string;
}

export interface RoleSplit {
  philosophy: string;
  primary_elicitation?: PrimaryElicitation;
  translation: { definition: string; signals: string[] };
  judgement: { definition: string; signals: string[] };
  derivation_rule: string;
  invitee_deliverable: string;
  trust_invariant: string;
}

export interface Ontology {
  meta: {
    version: string;
    philosophy: string;
    analogy_floor: number;
  };
  axes: Axis[];
  consequence_rules: ConsequenceRulesV2;
  interactions: Interaction[];
  analogy_library: AnalogyEntry[];
  role_split: RoleSplit;
}

export interface AxisPosition {
  axisId: string;
  position: string;
  confidence: number;
  evidence: Array<{ source: string; quote: string; provenance: Provenance }>;
  candidateA?: { position: string; implication: string };
  candidateB?: { position: string; implication: string };
  disambiguatingQuestion?: string;
  // v2 consequence inputs (additive). Present only when the axis is
  // atypical for this company. `magnitude` is the agent's 0..1 score
  // for "how far from typical for that axis"; `hotProblem` is the
  // named problem the deviation implies.
  deviation?: {
    magnitude: number;
    hotProblem: string;
  };
}
