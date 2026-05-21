import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import {
  coerceRole,
  isGraphNodeType,
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

# Output

ONE JSON object on ONE line:

{"nodes":[{"nodeType":"...","role":"...","name":"...","notes":"...","provenance":"..."},{...}]}

No prose. No markdown fences. No keys other than "nodes".`;

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

export async function extractGraphNodes(
  input: GraphExtractInput
): Promise<ExtractedGraphNode[]> {
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
  };

  const raw = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const out: ExtractedGraphNode[] = [];
  for (const n of raw) {
    if (!isGraphNodeType(n.nodeType)) continue;
    const name = typeof n.name === 'string' ? n.name.trim().slice(0, 200) : '';
    if (!name) continue;
    out.push({
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
  return out;
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
