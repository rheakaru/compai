/**
 * Acceptance check for the connector map:
 * given the Hoovu axis vector, the populated festival_forecast_wire MUST
 * fire (because concentration_x_zero_slack_cash fires for that vector).
 *
 * Run: npx tsx scripts/verify-connector-map.ts
 */
import { loadOntology } from '../lib/ontology/loader';
import { computeConnectorMap } from '../lib/model/connector-map';
import type { AxisPositionClaim } from '../lib/model/claims';

function axisClaim(
  axisId: string,
  position: string,
  opts: { confidence?: number; deviationMagnitude?: number; deviationHotProblem?: string } = {}
): AxisPositionClaim {
  return {
    id: `t_${axisId}`,
    kind: 'axis_position',
    content: {
      axisId,
      position,
      confidence: opts.confidence ?? 0.8,
      evidence: [],
      ...(opts.deviationMagnitude !== undefined && opts.deviationHotProblem
        ? { deviation: { magnitude: opts.deviationMagnitude, hotProblem: opts.deviationHotProblem } }
        : {})
    },
    provenance: 'inferred_public',
    confidence: opts.confidence ?? 0.8,
    supersededBy: null,
    createdAt: Date.now()
  };
}

const HOOVU: AxisPositionClaim[] = [
  axisClaim('codp', 'MTO', { confidence: 0.75 }),
  axisClaim('demand_uncertainty', 'high', { confidence: 0.85 }),
  axisClaim('volume_variety', 'high_vol_low_var'),
  axisClaim('value_chain_position', 'distributor_reseller'),
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
  axisClaim('transaction_regime', 'low_aov_high_freq'),
  axisClaim('asset_specificity', 'market'),
  axisClaim('perishability', 'above_threshold', { confidence: 0.95 })
];

const { ontology } = loadOntology();
const map = computeConnectorMap({ axisClaims: HOOVU, ontology });

console.log('Connector map result for Hoovu:\n');
console.log(`  patternsAvailable: ${map.patternsAvailable}`);
console.log(`  patternsPopulated: ${map.patternsPopulated}`);
console.log(`  honestStop:        ${map.honestStop}`);
console.log(`  wires:             ${map.wires.length}\n`);
for (const w of map.wires) {
  console.log(`  • [${w.patternId}] ${w.from} → ${w.to}`);
  console.log(`    via: ${w.via}`);
  console.log(`    unlocks: ${w.what_it_unlocks}\n`);
}

const hasFestival = map.wires.some(w => w.patternId === 'festival_forecast_wire');
console.log(hasFestival ? '✅ ACCEPTANCE PASSED — festival_forecast_wire fires' : '❌ ACCEPTANCE FAILED');
process.exit(hasFestival ? 0 : 1);
