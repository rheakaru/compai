/**
 * Acceptance check for the consequence v2 rebuild:
 * given a Hoovu-shaped axis vector, the top hot problem must be the
 * concentration_x_zero_slack_cash declared interaction.
 *
 * Run: npx tsx scripts/verify-hoovu-acceptance.ts
 */
import { loadOntology } from '../lib/ontology/loader';
import { computeHotDormant } from '../lib/model/projection';
import type { AxisPositionClaim } from '../lib/model/claims';

function axisClaim(
  axisId: string,
  position: string,
  opts: { confidence?: number; deviationMagnitude?: number; deviationHotProblem?: string } = {}
): AxisPositionClaim {
  return {
    id: `test_${axisId}`,
    kind: 'axis_position',
    content: {
      axisId,
      position,
      confidence: opts.confidence ?? 0.8,
      evidence: [],
      ...(opts.deviationMagnitude !== undefined && opts.deviationHotProblem
        ? {
            deviation: {
              magnitude: opts.deviationMagnitude,
              hotProblem: opts.deviationHotProblem
            }
          }
        : {})
    },
    provenance: 'inferred_public',
    confidence: opts.confidence ?? 0.8,
    supersededBy: null,
    createdAt: Date.now()
  };
}

const HOOVU: AxisPositionClaim[] = [
  // Hoovu Fresh: B2B perishable flower supply chain in India
  axisClaim('codp', 'MTO', { confidence: 0.75 }),
  axisClaim('demand_uncertainty', 'high', { confidence: 0.85 }),
  axisClaim('volume_variety', 'high_vol_low_var', { confidence: 0.7 }),
  axisClaim('value_chain_position', 'distributor_reseller', { confidence: 0.75 }),
  axisClaim('cash_conversion', 'long_positive', {
    confidence: 0.85,
    deviationMagnitude: 0.7,
    deviationHotProblem: 'working-capital crunch during festival ramps'
  }),
  axisClaim('customer_concentration', 'concentrated', {
    confidence: 0.85,
    deviationMagnitude: 0.85,
    deviationHotProblem: 'churn exposure to a small number of large temple/B2B accounts'
  }),
  axisClaim('transaction_regime', 'low_aov_high_freq', { confidence: 0.7 }),
  axisClaim('asset_specificity', 'market', { confidence: 0.65 }),
  axisClaim('perishability', 'above_threshold', { confidence: 0.95 })
];

const { ontology } = loadOntology();
const ranked = computeHotDormant({ axisClaims: HOOVU, ontology });

const hot = ranked.filter(c => !c.content.isDormant);
console.log('Top 6 hot problems:\n');
for (const [i, c] of hot.slice(0, 6).entries()) {
  const sources = c.content.sources?.join('+') ?? '?';
  const firing = c.content.interactionFirings?.[0];
  const axesNames = firing ? firing.axes.join(' × ') : (c.content.voterAxes ?? []).join(', ');
  console.log(
    `${i + 1}. [${sources}] ${c.content.problemId}\n` +
      `   axes: ${axesNames}\n` +
      `   weight: ${c.content.weight}  (P=${c.content.breakdown?.position} D=${c.content.breakdown?.deviation} I=${c.content.breakdown?.interaction})\n`
  );
}

const top = hot[0];
const topFiring = top?.content.interactionFirings?.[0];
const passed =
  topFiring?.interactionId === 'concentration_x_zero_slack_cash' &&
  topFiring.source === 'declared';

console.log('\n' + (passed ? '✅ ACCEPTANCE PASSED' : '❌ ACCEPTANCE FAILED'));
console.log(
  `   Top is ${topFiring?.interactionId ?? top?.content.problemId ?? 'unknown'} (source: ${topFiring?.source ?? top?.content.sources?.join('+') ?? 'n/a'})`
);
process.exit(passed ? 0 : 1);
