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

/**
 * Plain-English fallback labels per controlled-vocabulary position token.
 * Used when the agent forgot to emit `plainSummary` or stuffed extra text
 * into the `position` field. The agent prompt mandates plainSummary, but
 * this table guarantees a readable card even when the model misbehaves.
 *
 * Keys are the canonical token (e.g. "MTO"); the lookup also tries the
 * normalised prefix before any space, paren, or em-dash so positions like
 * "long_positive (structurally negative working capital gap)" still
 * resolve.
 */
const POSITION_LABELS: Record<string, Record<string, string>> = {
  codp: {
    MTS: 'Make to stock — products ready before orders arrive',
    ATO: 'Assemble to order — components on hand, final config on order',
    MTO: 'Make to order — built fresh when each order lands',
    ETO: 'Engineer to order — every order is partly bespoke'
  },
  demand_uncertainty: {
    low: 'Demand is predictable, day in and day out',
    high: 'Demand is volatile — hard to forecast at commit',
    bimodal: 'Steady most days, sharp spikes on a few'
  },
  volume_variety: {
    low_vol_high_var: 'Many different things, in small batches each',
    batch_midrange: 'A medium set of things, run in batches',
    high_vol_low_var: 'A small set of things, in big daily volumes',
    project: 'Project-by-project — each one different',
    jobbing: 'Job shop — varied work, one off at a time',
    batch: 'Batched work — the same recipe runs together',
    mass: 'Mass production — one product, at scale',
    continuous: 'Continuous flow — never stops'
  },
  value_chain_position: {
    producer: 'You make the thing yourself',
    assembler_converter: 'You convert or assemble inputs into the product',
    distributor_reseller: 'You buy and resell — margin comes from sourcing and selection',
    aggregator_marketplace: 'You match buyers and sellers — margin from the spread',
    platform_infra: 'You run the infrastructure others build on'
  },
  cash_conversion: {
    negative_or_short: 'You get paid before you pay out — growth funds itself',
    long_positive: 'Cash is locked up in inventory and receivables for weeks'
  },
  customer_concentration: {
    concentrated: 'A handful of customers drive most of the revenue',
    mid: 'A mix — some big accounts, many smaller ones',
    distributed: 'Many small customers — no one of them is critical'
  },
  transaction_regime: {
    low_aov_high_freq: 'Small orders, many times — replenishment economics',
    high_aov_low_freq: 'Big orders, rarely — each one has to clear the cost of winning it',
    low_aov_low_freq: 'Small orders, rarely — basket upsell is the lever',
    high_aov_high_freq: 'Big orders, often — account expansion is the lever'
  },
  asset_specificity: {
    market: "You buy and outsource — you don't own the production",
    hierarchy: 'You make it yourself — owned capacity, owned skill',
    hybrid: 'A mix of owned and bought — long-term contracts and partnerships'
  },
  perishability: {
    above_threshold: "What you don't sell today is worth nothing tomorrow",
    below_threshold: 'The product holds its value — no clock on it'
  }
};

/**
 * Resolve the card headline for an axis position. Falls through:
 *   1. agent-emitted plainSummary (most company-specific)
 *   2. controlled-vocabulary lookup in POSITION_LABELS (generic plain-English)
 *   3. raw position string with underscores prettified (last resort)
 */
export function resolveAxisHeadline(opts: {
  axisId: string;
  position: string;
  plainSummary?: string | null;
}): string {
  const plain = opts.plainSummary?.trim();
  if (plain) return plain;

  // Try direct lookup first, then the prefix before any space/paren/em-dash
  // (handles model-emitted positions like "long_positive (structurally...)" or
  // "mid-to-high (hierarchy-leaning) — own packing warehouses").
  const byAxis = POSITION_LABELS[opts.axisId];
  if (byAxis) {
    const direct = byAxis[opts.position];
    if (direct) return direct;
    const token = opts.position.split(/[\s(——]/)[0];
    if (token && byAxis[token]) return byAxis[token];
  }

  return prettifyToken(opts.position);
}

function prettifyToken(s: string): string {
  return s.replace(/_/g, ' ');
}

