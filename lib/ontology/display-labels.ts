// Display-layer labels for axes. This is a frontend rendering concern only.
// It does NOT modify ontology.yaml, axis ids, axis names, load-bearing ranks,
// or any consequence computation. All computation continues to key off the
// ontology's axis `id` and `name` exactly as before.

export interface AxisDisplayLabel {
  /** Scannable question-word headline a cold reader can grok at a glance. */
  handle: string;
  /** Plain-meaning title — the card headline. */
  title: string;
  /** The ontology axis name. Shown small in the evidence body for expertise signal. */
  technical_term: string;
  /** One-line subtitle posed as a contrast. */
  gloss: string;
}

export const AXIS_DISPLAY_LABELS: Record<string, AxisDisplayLabel> = {
  volume_variety: {
    handle: 'What you make',
    title: 'How Repetitive the Work Is',
    technical_term: 'Volume × Variety Regime',
    gloss: 'Few things many times, or many things few times?'
  },
  demand_uncertainty: {
    handle: 'Why you make it',
    title: 'Demand Predictability',
    technical_term: 'Demand Uncertainty',
    gloss: 'Is demand known, or guessed?'
  },
  codp: {
    handle: 'When you make',
    title: 'Make-to-Order vs Make-to-Stock',
    technical_term: 'Customer Order Decoupling Point',
    gloss: 'Do you build before or after the order arrives?'
  },
  value_chain_position: {
    handle: 'Where you sit',
    title: 'Your Link in the Chain',
    technical_term: 'Value-Chain Position',
    gloss: 'Make, convert, resell, or match?'
  },
  cash_conversion: {
    handle: 'How money moves',
    title: 'How Long Cash Is Tied Up',
    technical_term: 'Working-Capital Intensity',
    gloss: 'The gap between paying out and getting paid'
  },
  customer_concentration: {
    handle: 'Who you sell to',
    title: 'How Concentrated Your Customers Are',
    technical_term: 'Customer Concentration',
    gloss: 'A few big customers, or many small ones?'
  },
  transaction_regime: {
    handle: 'How they buy',
    title: 'Order Size vs Frequency',
    technical_term: 'Transaction Regime',
    gloss: 'Small & often, or big & rare?'
  },
  asset_specificity: {
    handle: 'How you make it',
    title: 'Build It or Buy It',
    technical_term: 'Asset Specificity / Vertical Integration',
    gloss: 'What you own versus what you rent'
  },
  perishability: {
    handle: 'How long it lasts',
    title: 'Shelf Life',
    technical_term: 'Perishability / Process Time-Sensitivity',
    gloss: "How fast the product's value decays"
  }
};

/**
 * Explicit top-to-bottom order for the Shape section. Independent of ontology
 * order and of load-bearing rank — interleaves load-bearing and refining axes
 * by narrative flow. The "LOAD-BEARING · #n" / "REFINING · #n" tag on each
 * card still comes from the ontology rank, preserving the rank signal.
 */
export const AXIS_DISPLAY_ORDER: string[] = [
  'volume_variety',
  'demand_uncertainty',
  'codp',
  'value_chain_position',
  'cash_conversion',
  'customer_concentration',
  'transaction_regime',
  'asset_specificity',
  'perishability'
];

export function getAxisLabel(axisId: string, fallbackName: string): AxisDisplayLabel {
  return (
    AXIS_DISPLAY_LABELS[axisId] ?? {
      handle: '',
      title: fallbackName,
      technical_term: fallbackName,
      gloss: ''
    }
  );
}
