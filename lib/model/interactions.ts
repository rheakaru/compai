import type { Interaction, Ontology } from '@/lib/ontology/types';
import type { AxisPositionClaim } from './claims';

/**
 * A declared interaction's match for a given vector. Score is 0..1 strength.
 * Matchers are intentionally narrow — declared interactions are PRIORS;
 * unlisted compounding pairs come from the agent and carry `agent_hypothesis`
 * provenance. Never claim agent-inferred interactions as established.
 */
export interface InteractionFiring {
  interactionId: string;
  axes: string[];
  hotProblem: string;
  mechanism: string;
  strength: number;
  source: 'declared' | 'agent_hypothesis';
}

type Matcher = (positions: Map<string, string>, claims: AxisPositionClaim[]) => number | null;

/**
 * Per-interaction matchers. Each returns a strength 0..1 if the interaction
 * fires for this vector, or null if it does not. Strengths are deterministic
 * functions of the company's axis values — no agent inference here.
 *
 * The matchers encode the `fires_when` text from ontology.yaml. Adding a new
 * declared interaction means adding its matcher here.
 */
const MATCHERS: Record<string, Matcher> = {
  // "customer_concentration = extremely high AND cash_conversion has near-zero
  //  inventory slack (MTO/perishable)"
  // We map this to: concentration ∈ {concentrated}, and slack-poor signal
  // from cash_conversion=long_positive OR codp=MTO/ETO OR perishability=above_threshold.
  concentration_x_zero_slack_cash: (p) => {
    const concentration = p.get('customer_concentration');
    if (concentration !== 'concentrated') return null;
    const cash = p.get('cash_conversion');
    const codp = p.get('codp');
    const perish = p.get('perishability');
    const slackPoor =
      cash === 'long_positive' ||
      codp === 'MTO' ||
      codp === 'ETO' ||
      perish === 'above_threshold';
    if (!slackPoor) return null;
    // Strength scales with how many slack-poor signals fire (capped at 1.0).
    let signals = 0;
    if (cash === 'long_positive') signals += 0.45;
    if (codp === 'MTO' || codp === 'ETO') signals += 0.3;
    if (perish === 'above_threshold') signals += 0.35;
    return Math.min(1.0, 0.6 + signals);
  },

  // "volume_variety = low_vol_high_var AND regulatory traceability load is
  //  high (declared in evidence)"
  // We can't read "declared in evidence" deterministically without an agent
  // call; we proxy with asset_specificity=hierarchy (vertically integrated
  // production typically signals regulated industries — defence/medical/aero).
  variety_x_regulatory_traceability: (p) => {
    const vv = p.get('volume_variety');
    const as = p.get('asset_specificity');
    if (vv !== 'low_vol_high_var') return null;
    if (as !== 'hierarchy') return null;
    return 0.8;
  }
};

export function detectDeclaredInteractions(
  axisClaims: AxisPositionClaim[],
  ontology: Ontology,
  minConfidence = 0.4
): InteractionFiring[] {
  const positions = new Map<string, string>();
  for (const c of axisClaims) {
    if (c.content.confidence < minConfidence) continue;
    positions.set(c.content.axisId, c.content.position);
  }

  const firings: InteractionFiring[] = [];
  for (const interaction of ontology.interactions ?? []) {
    const matcher = MATCHERS[interaction.id];
    if (!matcher) continue;
    const strength = matcher(positions, axisClaims);
    if (strength === null) continue;
    firings.push({
      interactionId: interaction.id,
      axes: interaction.axes,
      hotProblem: interaction.hot_problem,
      mechanism: interaction.compounding_mechanism,
      strength,
      source: 'declared'
    });
  }
  return firings;
}

/**
 * Agent-surfaced interactions arrive via the research stream as `interaction`
 * events. They are stored alongside declared firings but ALWAYS carry
 * `agent_hypothesis` provenance and are tagged in the UI accordingly.
 */
export function agentInteractionToFiring(
  axes: string[],
  hotProblem: string,
  mechanism: string,
  strength: number
): InteractionFiring {
  return {
    interactionId: 'agent_' + Buffer.from(axes.join('+') + ':' + hotProblem).toString('base64').slice(0, 24),
    axes,
    hotProblem,
    mechanism,
    strength: Math.max(0, Math.min(1, strength)),
    source: 'agent_hypothesis'
  };
}

export function interactionFromOntology(
  interactionId: string,
  ontology: Ontology
): Interaction | undefined {
  return ontology.interactions?.find(i => i.id === interactionId);
}
