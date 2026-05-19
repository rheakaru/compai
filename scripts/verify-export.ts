/**
 * Acceptance for the context-graph export:
 * 1. Serializing the Hoovu projection produces a Markdown doc with all the
 *    required sections + provenance tags.
 * 2. Correcting a claim and re-serializing changes the document (proving
 *    it is a live serialization, not a snapshot).
 *
 * Run: npx tsx scripts/verify-export.ts
 */
import { loadOntology } from '../lib/ontology/loader';
import { projectFromClaims } from '../lib/model/projection';
import { serializeContextGraph } from '../lib/export/context-graph';
import type { AxisPositionClaim, Claim, FactClaim } from '../lib/model/claims';

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
      evidence: [
        {
          source: 'https://hoovufresh.com',
          quote: `Position pulled from the company's about page.`,
          provenance: 'found_on_site'
        }
      ],
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

const HOOVU: Claim[] = [
  // facts
  {
    id: 'f1',
    kind: 'fact',
    content: { statement: 'Hoovu Fresh supplies flowers to temples and B2B clients.', source: 'https://hoovufresh.com' },
    provenance: 'found_on_site',
    confidence: 0.95,
    supersededBy: null,
    createdAt: Date.now()
  } as FactClaim,
  // axes
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
const projection1 = projectFromClaims(HOOVU, ontology);
const md1 = serializeContextGraph({
  projection: projection1,
  ontology,
  companyName: 'Hoovu Fresh',
  companyUrl: 'https://hoovufresh.com',
  includePreamble: true
});

const claims2: Claim[] = HOOVU.map(c => {
  // "Correct" customer_concentration from concentrated -> distributed
  if (c.kind === 'axis_position' && c.content.axisId === 'customer_concentration') {
    return {
      ...c,
      content: { ...c.content, position: 'distributed', deviation: undefined }
    };
  }
  return c;
});
const projection2 = projectFromClaims(claims2, ontology);
const md2 = serializeContextGraph({
  projection: projection2,
  ontology,
  companyName: 'Hoovu Fresh',
  companyUrl: 'https://hoovufresh.com',
  includePreamble: true
});

const md1WithoutPreamble = serializeContextGraph({
  projection: projection1,
  ontology,
  companyName: 'Hoovu Fresh',
  companyUrl: 'https://hoovufresh.com',
  includePreamble: false
});

console.log('--- export 1 (concentrated) preview ---');
console.log(md1.split('\n').slice(0, 14).join('\n'));
console.log('...');
console.log('--- export 2 (corrected -> distributed) sample concentration line ---');
const lineWithConcentration2 = md2.split('\n').find(l => l.toLowerCase().includes('concentration'));
console.log(lineWithConcentration2);

const concentratedInMd1 = md1.includes('`concentrated`');
const distributedInMd2 = md2.includes('`distributed`');
const preambleMissing = !md1WithoutPreamble.includes('## How to use this graph');
const onSiteTagPresent = md1.includes('[on-site]');
const hypothesisTagPresent = md1.includes('[hypothesis]');
const acceptanceInteractionInMd1 = md1.includes('concentration_x_zero_slack_cash');
const acceptanceInteractionGoneInMd2 = !md2.includes('concentration_x_zero_slack_cash');

const allOk =
  concentratedInMd1 &&
  distributedInMd2 &&
  preambleMissing &&
  onSiteTagPresent &&
  hypothesisTagPresent &&
  acceptanceInteractionInMd1 &&
  acceptanceInteractionGoneInMd2 &&
  md1 !== md2;

console.log('\nChecks:');
console.log('  ✓ md1 contains `concentrated`:', concentratedInMd1);
console.log('  ✓ md2 contains `distributed`:', distributedInMd2);
console.log('  ✓ stripping preamble removes the section:', preambleMissing);
console.log('  ✓ on-site provenance tag present:', onSiteTagPresent);
console.log('  ✓ hypothesis provenance tag present:', hypothesisTagPresent);
console.log('  ✓ md1 references the Hoovu interaction:', acceptanceInteractionInMd1);
console.log('  ✓ md2 (post-correction) drops the interaction:', acceptanceInteractionGoneInMd2);
console.log('  ✓ md1 !== md2:', md1 !== md2);
console.log('\n' + (allOk ? '✅ EXPORT ACCEPTANCE PASSED' : '❌ EXPORT ACCEPTANCE FAILED'));
process.exit(allOk ? 0 : 1);
