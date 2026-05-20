import type { Provenance } from '@/lib/ontology/types';

/**
 * POLE+O context graph for a company. Five top-level categories — People,
 * Org, Location, Events, Objects — each with a small set of canonical roles.
 *
 * These nodes are CONTEXT, not engine inputs. They do not drive the
 * consequence computation, axis derivation, or the one-liner. They give the
 * page a navigable "this is what your world is made of" view that the
 * prospect can correct and enrich.
 *
 * Append-only is NOT used here (unlike claims). Graph nodes are lightweight
 * CRUD with a soft-delete timestamp.
 */

export type GraphNodeType = 'person' | 'org' | 'location' | 'event' | 'object';

export const GRAPH_TYPE_ORDER: GraphNodeType[] = [
  'person',
  'org',
  'location',
  'event',
  'object'
];

export const GRAPH_TYPE_LABELS: Record<GraphNodeType, string> = {
  person: 'People',
  org: 'Orgs',
  location: 'Locations',
  event: 'Events',
  object: 'Objects'
};

export const GRAPH_TYPE_HINTS: Record<GraphNodeType, string> = {
  person: 'team, founders, customer & vendor contacts',
  org: 'customers, vendors, competitors, partners, investors',
  location: 'HQ, offices, warehouses, factories, key markets',
  event: 'recurring meetings, festivals, seasonal peaks, milestones',
  object: 'products, SKUs, machinery, raw materials, key software'
};

export const GRAPH_ROLE_OPTIONS: Record<GraphNodeType, string[]> = {
  person: ['founder', 'leadership', 'team', 'customer_contact', 'vendor_contact', 'other'],
  org: ['customer', 'vendor', 'competitor', 'partner', 'investor', 'this_company', 'other'],
  location: ['hq', 'office', 'warehouse', 'factory', 'market', 'other'],
  event: ['recurring_meeting', 'festival', 'season', 'milestone', 'other'],
  object: ['sku', 'product', 'machinery', 'raw_material', 'software', 'ip', 'other']
};

export const GRAPH_ROLE_LABELS: Record<string, string> = {
  // person
  founder: 'Founder',
  leadership: 'Leadership',
  team: 'Team',
  customer_contact: 'Customer contact',
  vendor_contact: 'Vendor contact',
  // org
  customer: 'Customer',
  vendor: 'Vendor',
  competitor: 'Competitor',
  partner: 'Partner',
  investor: 'Investor',
  this_company: 'This company',
  // location
  hq: 'HQ',
  office: 'Office',
  warehouse: 'Warehouse',
  factory: 'Factory',
  market: 'Market',
  // event
  recurring_meeting: 'Recurring meeting',
  festival: 'Festival',
  season: 'Season',
  milestone: 'Milestone',
  // object
  sku: 'SKU',
  product: 'Product',
  machinery: 'Machinery',
  raw_material: 'Raw material',
  software: 'Software',
  ip: 'IP',
  // fallback
  other: 'Other'
};

export interface GraphNode {
  id: string;
  companyId: string;
  type: GraphNodeType;
  role: string;
  name: string;
  notes?: string;
  source: 'agent' | 'user';
  provenance: Provenance;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export function isGraphNodeType(v: unknown): v is GraphNodeType {
  return v === 'person' || v === 'org' || v === 'location' || v === 'event' || v === 'object';
}

export function coerceRole(type: GraphNodeType, raw: unknown): string {
  if (typeof raw !== 'string') return 'other';
  const allowed = GRAPH_ROLE_OPTIONS[type];
  if (allowed.includes(raw)) return raw;
  // Permit free text — store as-is; UI will fall back to "other" label only
  // when the role doesn't appear in GRAPH_ROLE_LABELS.
  return raw.slice(0, 60);
}
