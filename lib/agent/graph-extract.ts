import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import {
  coerceEdgeLabel,
  coerceRole,
  isGraphNodeType,
  type GraphEdge,
  type GraphNode,
  type GraphNodeType
} from '@/lib/model/graph';
import type {
  AxisPositionClaim,
  FactClaim,
  OneLinerClaim
} from '@/lib/model/claims';
import type { Provenance } from '@/lib/ontology/types';

/**
 * Graph extraction runs AFTER the main research stream as a dedicated
 * agent pass. Asking the research agent to emit graph_node events inline
 * was unreliable — it skipped them under load. A separate, narrowly-scoped
 * agent that only emits graph nodes is deterministic and reproducible.
 *
 * Cost: one Sonnet 4.6 call per company. No web search.
 */

let client: Anthropic | null = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

const KNOWN_PROVENANCE = new Set<Provenance>([
  'found_on_site',
  'inferred_public',
  'agent_hypothesis'
]);

function coerceProvenance(v: unknown): Provenance {
  if (typeof v === 'string' && KNOWN_PROVENANCE.has(v as Provenance)) return v as Provenance;
  return 'agent_hypothesis';
}

const SYSTEM = `You extract POLE+O context graph nodes from a company's existing diagnosis. You do NOT do new research — you re-shape what's already known into named entities.

POLE+O categories — emit nodes across all five when the diagnosis supports it:

- person — founder, leadership, team, customer_contact, vendor_contact, other
- org — this_company, customer, vendor, competitor, partner, investor, other
- location — hq, office, warehouse, factory, market, other
- event — recurring_meeting, festival, season, milestone, other
- object — sku, product, machinery, raw_material, software, ip, other

# Coverage

Emit 12–25 nodes total. Cover what the diagnosis already supports:

- ALWAYS emit one node for the company itself (org, role this_company)
- Named founders + leadership → person (founder, leadership)
- Named customers → org (customer)
- Named competitors → org (competitor)
- Named vendors → org (vendor)
- HQ city + any named offices/warehouses/factories → location
- Recurring events (festivals, seasons, weekly meetings if mentioned) → event
- Key SKUs / product lines / raw materials → object

# Rules

- Skip categories with no evidence — DO NOT invent. If the facts don't mention a competitor by name, do not invent one.
- Names ≤ 60 chars. Notes ≤ 200 chars and only when they add real context.
- Provenance: tag found_on_site only when the source URL is the company's own site; inferred_public for news / third-party sources; agent_hypothesis for anything you're inferring without a direct citation.
- One node per distinct entity. Do not duplicate.

# Edges — relationships between nodes

After the nodes, also emit edges where the diagnosis clearly supports a connection. Common relationships to look for:
- Org "sells to" Org (the company sells to a customer org)
- Org "supplies" Org (a vendor supplies this company)
- Org / Person "located at" Location
- Org "competes with" Org
- Event "drives demand for" Object
- Object "sourced from" Org
- Person "works at" Org

Rules:
- Reference nodes by their EXACT \`name\` field as emitted in the nodes list above. The matcher is name-based.
- Skip edges you can't substantiate from the diagnosis. Do NOT invent connections.
- 0–15 edges. Quality over quantity. If you have no clear relationships, emit none.

# Output

ONE JSON object on ONE line:

{"nodes":[{"nodeType":"...","role":"...","name":"...","notes":"...","provenance":"..."}],"edges":[{"from":"<exact node name>","to":"<exact node name>","label":"sells to|supplies|...","notes":"...","provenance":"..."}]}

No prose. No markdown fences. Only "nodes" and "edges" keys.`;

export interface GraphExtractInput {
  companyName: string | null;
  companyUrl: string;
  oneLiner: OneLinerClaim | null;
  facts: FactClaim[];
  axisClaims: AxisPositionClaim[];
}

export interface ExtractedGraphNode {
  nodeType: GraphNodeType;
  role: string;
  name: string;
  notes?: string;
  provenance: Provenance;
}

export interface ExtractedGraphEdge {
  from: string;        // matches an ExtractedGraphNode.name
  to: string;
  label: string;
  notes?: string;
  provenance: Provenance;
}

export interface GraphExtractResult {
  nodes: ExtractedGraphNode[];
  edges: ExtractedGraphEdge[];
}

export async function extractGraphNodes(
  input: GraphExtractInput
): Promise<GraphExtractResult> {
  const factLines = input.facts
    .map(f => {
      const cat = f.content.category ? `[${f.content.category}] ` : '';
      const src = f.content.source ? ` (${f.content.source})` : '';
      return `- ${cat}${f.content.statement} {${f.provenance}}${src}`;
    })
    .join('\n');

  const axisLines = input.axisClaims
    .map(c => {
      const ev = c.content.evidence.map(e => `"${e.quote.slice(0, 120)}"`).join(' · ');
      const dev = c.content.deviation
        ? ` [deviation: ${c.content.deviation.hotProblem}]`
        : '';
      return `- ${c.content.axisId} = ${c.content.position}${dev}\n  evidence: ${ev}`;
    })
    .join('\n');

  const userMsg = [
    `Company name: ${input.companyName ?? '(unknown)'}`,
    `Company URL: ${input.companyUrl}`,
    input.oneLiner
      ? `One-liner: ${input.oneLiner.content.sentence}`
      : 'One-liner: (none yet)',
    '',
    '# Facts collected',
    factLines || '(none)',
    '',
    '# Axis evidence (use to extract entities mentioned in quotes)',
    axisLines || '(none)',
    '',
    'Extract the POLE+O graph nodes per the system instructions. Return only the JSON.'
  ].join('\n');

  const res = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }]
  });

  const text = res.content
    .filter(b => b.type === 'text')
    .map(b => (b as { text: string }).text)
    .join('')
    .trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('graph-extract agent did not return JSON');
  }
  const parsed = JSON.parse(text.slice(start, end + 1)) as {
    nodes?: Array<{
      nodeType?: unknown;
      role?: unknown;
      name?: unknown;
      notes?: unknown;
      provenance?: unknown;
    }>;
    edges?: Array<{
      from?: unknown;
      to?: unknown;
      label?: unknown;
      notes?: unknown;
      provenance?: unknown;
    }>;
  };

  const rawNodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const nodes: ExtractedGraphNode[] = [];
  for (const n of rawNodes) {
    if (!isGraphNodeType(n.nodeType)) continue;
    const name = typeof n.name === 'string' ? n.name.trim().slice(0, 200) : '';
    if (!name) continue;
    nodes.push({
      nodeType: n.nodeType,
      role: coerceRole(n.nodeType, n.role),
      name,
      notes:
        typeof n.notes === 'string' && n.notes.trim()
          ? n.notes.trim().slice(0, 400)
          : undefined,
      provenance: coerceProvenance(n.provenance)
    });
  }

  const rawEdges = Array.isArray(parsed.edges) ? parsed.edges : [];
  const edges: ExtractedGraphEdge[] = [];
  for (const e of rawEdges) {
    const from = typeof e.from === 'string' ? e.from.trim() : '';
    const to = typeof e.to === 'string' ? e.to.trim() : '';
    if (!from || !to || from === to) continue;
    edges.push({
      from,
      to,
      label: coerceEdgeLabel(e.label),
      notes:
        typeof e.notes === 'string' && e.notes.trim()
          ? e.notes.trim().slice(0, 400)
          : undefined,
      provenance: coerceProvenance(e.provenance)
    });
  }

  return { nodes, edges };
}

/**
 * Build a full GraphNode (with ids, timestamps) from an extracted shape.
 * Used by both the post-research extraction in /api/research and the
 * backfill endpoint.
 */
export function buildGraphNode(opts: {
  companyId: string;
  extracted: ExtractedGraphNode;
}): GraphNode {
  const now = Date.now();
  return {
    id: randomUUID(),
    companyId: opts.companyId,
    type: opts.extracted.nodeType,
    role: opts.extracted.role,
    name: opts.extracted.name,
    notes: opts.extracted.notes,
    source: 'agent',
    provenance: opts.extracted.provenance,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
}

/**
 * De-duplicate against an existing set: skip extracted nodes whose
 * (type, role, lowercased name) already exists in the company's graph.
 */
export function dedupeAgainstExisting(
  extracted: ExtractedGraphNode[],
  existing: GraphNode[]
): ExtractedGraphNode[] {
  const seen = new Set<string>();
  for (const n of existing) {
    if (n.deletedAt) continue;
    seen.add(`${n.type}|${n.role}|${n.name.toLowerCase()}`);
  }
  const out: ExtractedGraphNode[] = [];
  const inThisBatch = new Set<string>();
  for (const e of extracted) {
    const key = `${e.nodeType}|${e.role}|${e.name.toLowerCase()}`;
    if (seen.has(key) || inThisBatch.has(key)) continue;
    inThisBatch.add(key);
    out.push(e);
  }
  return out;
}

/**
 * Resolve an agent-emitted edge (with from/to as node NAMES) into a
 * GraphEdge with from/to as node IDS, using a name -> id lookup. Returns
 * null when either endpoint can't be resolved.
 */
export function resolveEdge(opts: {
  extracted: ExtractedGraphEdge;
  nameToNodeId: Map<string, string>;
  companyId: string;
}): GraphEdge | null {
  const fromId = opts.nameToNodeId.get(opts.extracted.from.toLowerCase().trim());
  const toId = opts.nameToNodeId.get(opts.extracted.to.toLowerCase().trim());
  if (!fromId || !toId || fromId === toId) return null;
  const now = Date.now();
  return {
    id: '', // assigned at persist time
    companyId: opts.companyId,
    fromNodeId: fromId,
    toNodeId: toId,
    label: opts.extracted.label,
    notes: opts.extracted.notes,
    source: 'agent',
    provenance: opts.extracted.provenance,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
}
