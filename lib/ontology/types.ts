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

export interface RoleSplit {
  philosophy: string;
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
  consequence_rules: {
    method: string;
    weight: string;
    dormant_subtraction: boolean;
    output: string;
  };
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
}
