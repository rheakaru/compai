import type { Ontology } from '@/lib/ontology/types';

/**
 * The session-plan gate is DELIBERATELY a single pluggable seam.
 *
 * Per the patch: "the exact non-monetary commitment is deliberately
 * unspecified — the operator is still deciding what it is. Build the gate
 * as a single pluggable step with a clearly-marked seam (one component /
 * one config object) so the commitment requirement can be defined and
 * changed without restructuring the page or the funnel."
 *
 * To replace the commitment, change `PLACEHOLDER_COMMITMENT` below. To
 * A/B the payment variant, flip `payment_toggle.enabled` in ontology.yaml —
 * no code change needed.
 */

export interface GateCommitmentField {
  id: string;
  label: string;
  hint?: string;
  type: 'text' | 'textarea' | 'select';
  required: boolean;
  options?: string[];
  minLength?: number;
}

export interface GateCommitmentConfig {
  /** Short label for the gate ("Commit before we go further"). */
  title: string;
  /** Why this commitment, not no-commitment. Shown once above the fields. */
  rationale: string;
  /** The fields the prospect must complete. */
  fields: GateCommitmentField[];
  /** Submit-button copy. */
  submitLabel: string;
  /** Sentinel name. Logged as funnel meta so we can A/B different gates. */
  variantId: string;
  /** Whether this commitment is the deliberately-marked placeholder. */
  isPlaceholder: boolean;
}

export interface PaymentToggle {
  enabled: boolean;
  amountInr: number;
}

export interface ResolvedGate {
  commitment: GateCommitmentConfig;
  payment: PaymentToggle;
}

const PLACEHOLDER_COMMITMENT: GateCommitmentConfig = {
  title: 'Commit before we go further',
  rationale:
    'A one-day session is real work, on real data, on your machine. To make sure both sides walk in serious, name what would make this worth ₹1 lakh to you.',
  fields: [
    {
      id: 'companyName',
      label: 'Company name',
      type: 'text',
      required: true,
      hint: 'Confirm the company name we read above is right.'
    },
    {
      id: 'outcome',
      label: 'What outcome would make this worth ₹1 lakh to you?',
      hint: 'One sentence. Sharper answers get sharper sessions.',
      type: 'textarea',
      required: true,
      minLength: 30
    }
  ],
  submitLabel: 'See the one day',
  variantId: 'placeholder_co_name_plus_intent',
  isPlaceholder: true
};

export function resolveGate(ontology: Ontology): ResolvedGate {
  const toggle = ontology.session_projection?.gate?.payment_toggle;
  return {
    commitment: PLACEHOLDER_COMMITMENT,
    payment: {
      enabled: toggle?.enabled === true,
      amountInr: typeof toggle?.amount_inr === 'number' ? toggle.amount_inr : 0
    }
  };
}

export function validateGateSubmission(
  submission: Record<string, string>,
  config: GateCommitmentConfig
): { ok: true } | { ok: false; reason: string } {
  for (const field of config.fields) {
    const value = submission[field.id]?.trim() ?? '';
    if (field.required && !value) {
      return { ok: false, reason: `${field.label} is required.` };
    }
    if (field.minLength && value.length < field.minLength) {
      return { ok: false, reason: `${field.label} should be at least ${field.minLength} characters.` };
    }
  }
  return { ok: true };
}
