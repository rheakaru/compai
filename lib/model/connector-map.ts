import type { AxisPositionClaim } from './claims';
import type {
  ConnectorMapConfig,
  ConnectorPattern,
  ConnectorWire,
  Ontology
} from '@/lib/ontology/types';
import { detectDeclaredInteractions } from './interactions';

/**
 * Connector map computation. Pure function over the projection + ontology —
 * no agent calls.
 *
 * Rule (from the patch + ontology.honesty_floor):
 *   Only show wires from `connector_map.patterns` whose `wires` are
 *   populated AND whose firing condition matches this company's diagnosis.
 *   Stubs (wires === []) and patterns that don't fire produce the honest
 *   stop. Never fabricate.
 *
 *   v1 coverage:
 *     - festival_forecast_wire fires when concentration_x_zero_slack_cash
 *       fires for this company.
 *     - traceability_routing_wire fires when variety_x_regulatory_traceability
 *       fires.
 *     - cash_cycle_receivables_wire / subscription_replenishment_wire are
 *       stubs with empty wires; existence tells the generator what shape
 *       to look for, NOT to fabricate.
 */

export interface ConnectorMapWire extends ConnectorWire {
  patternId: string;
  seenIn?: string;
}

export interface ConnectorMapResult {
  wires: ConnectorMapWire[];
  honestStop: boolean;
  /** How many patterns the ontology declares total — for telemetry. */
  patternsAvailable: number;
  /** How many of those have populated wires today — for the operator's worklist. */
  patternsPopulated: number;
}

const DEFAULT_MAX = 3;

export function computeConnectorMap(opts: {
  axisClaims: AxisPositionClaim[];
  ontology: Ontology;
}): ConnectorMapResult {
  const cm: ConnectorMapConfig | undefined = opts.ontology.connector_map;
  if (!cm || !Array.isArray(cm.patterns)) {
    return { wires: [], honestStop: true, patternsAvailable: 0, patternsPopulated: 0 };
  }

  const max = cm.honesty_floor?.max_connections ?? DEFAULT_MAX;
  const patternsAvailable = cm.patterns.length;
  const patternsPopulated = cm.patterns.filter(p => Array.isArray(p.wires) && p.wires.length > 0).length;

  // Which declared interactions fire for this company?
  const firings = detectDeclaredInteractions(opts.axisClaims, opts.ontology);
  const firedIds = new Set(firings.map(f => f.interactionId));

  const out: ConnectorMapWire[] = [];
  for (const pattern of cm.patterns) {
    if (!isPopulated(pattern)) continue;
    if (!pattern.fires_when_interaction) continue;
    if (!firedIds.has(pattern.fires_when_interaction)) continue;
    for (const wire of pattern.wires) {
      if (out.length >= max) break;
      out.push({
        ...wire,
        patternId: pattern.id,
        seenIn: pattern.seen_in
      });
    }
    if (out.length >= max) break;
  }

  return {
    wires: out,
    honestStop: out.length === 0,
    patternsAvailable,
    patternsPopulated
  };
}

function isPopulated(p: ConnectorPattern): boolean {
  return Array.isArray(p.wires) && p.wires.length > 0;
}
