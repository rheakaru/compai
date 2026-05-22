import type { Profile } from '@/lib/model/projection';
import type {
  AxisPositionClaim,
  FactClaim,
  HardProblemClaim,
  OneLinerClaim
} from '@/lib/model/claims';
import type { Ontology, Provenance } from '@/lib/ontology/types';
import { getAxisLabel } from '@/lib/ontology/display-labels';

/**
 * Serialise the LIVE projection of a company as a single Markdown document
 * suitable for pasting into a consuming LLM.
 *
 * Non-negotiables:
 * - Markdown only — no JSON, no second format.
 * - Structure follows ontology.context_graph_export.structure (the LLM
 *   priming order; reordering breaks the artifact).
 * - Every claim carries its provenance tag.
 * - Re-serialised live every time — corrections show up immediately.
 * - Preamble is default-on; the caller may strip it but must not opt in.
 */
export function serializeContextGraph(opts: {
  projection: Profile;
  ontology: Ontology;
  companyName: string | null;
  companyUrl: string | null;
  includePreamble: boolean;
}): string {
  const { projection, ontology, companyName, companyUrl, includePreamble } = opts;
  const cfg = ontology.context_graph_export;
  if (!cfg) {
    throw new Error('ontology.context_graph_export missing');
  }

  const out: string[] = [];
  out.push(headerBlock({ companyName, companyUrl, ontologyVersion: ontology.meta.version }));

  for (const sectionKey of cfg.structure) {
    switch (sectionKey) {
      case 'preamble':
        if (includePreamble) out.push(preambleSection(cfg.method_preamble));
        break;
      case 'one_liner':
        out.push(oneLinerSection(projection.oneLiner));
        break;
      case 'vector':
        out.push(vectorSection(projection.axes, ontology));
        break;
      case 'hard_problems':
        out.push(hardProblemsSection(projection.hardProblems));
        break;
      case 'deviations_interactions':
        out.push(deviationsInteractionsSection(projection.axes, projection.hardProblems, ontology));
        break;
      case 'facts':
        out.push(factsSection(projection.facts));
        break;
      default:
        // Unknown section — skip silently rather than break the artifact.
        break;
    }
  }

  out.push(footerBlock());
  return out.filter(s => s.trim().length > 0).join('\n\n') + '\n';
}

// ---------------------------------------------------------------------------

const PROVENANCE_TAGS: Record<Provenance, string> = {
  found_on_site: 'on-site',
  inferred_public: 'public',
  agent_hypothesis: 'hypothesis',
  user_provided: 'owner'
};

function tag(p: Provenance): string {
  return `[${PROVENANCE_TAGS[p]}]`;
}

function headerBlock(opts: {
  companyName: string | null;
  companyUrl: string | null;
  ontologyVersion: string;
}): string {
  const displayName = opts.companyName ?? opts.companyUrl ?? 'this company';
  return [
    `# Structural diagnosis — ${displayName}`,
    opts.companyUrl ? `Source URL: ${opts.companyUrl}` : '',
    `Ontology version: ${opts.ontologyVersion}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    'Each claim is tagged with its provenance: `[on-site]`, `[public]`, `[hypothesis]`, `[owner]`. Hypotheses are explicitly marked because the agent flagged them — do not promote them.'
  ]
    .filter(Boolean)
    .join('\n');
}

function preambleSection(preamble: string): string {
  return ['## How to use this graph (instructions for the consuming LLM)', '', preamble.trim()].join('\n');
}

function oneLinerSection(claim: OneLinerClaim | null): string {
  if (!claim) {
    return '## One-liner\n\n_Not generated yet._';
  }
  const conf = claim.content.lowConfidence ? ' [low-confidence hypothesis]' : '';
  return [
    '## One-liner',
    '',
    `${claim.content.sentence}${conf}`,
    '',
    `> The structural claim. If your answer contradicts it, you have probably ignored the vector. ${tag(claim.provenance)}`
  ].join('\n');
}

function vectorSection(axes: AxisPositionClaim[], ontology: Ontology): string {
  const lines: string[] = ['## 9-axis vector', ''];
  const byId = new Map(axes.map(c => [c.content.axisId, c]));
  const ordered = [...ontology.axes].sort((a, b) => a.load_bearing_rank - b.load_bearing_rank);
  for (const axis of ordered) {
    const label = getAxisLabel(axis.id, axis.name);
    const claim = byId.get(axis.id);
    const rankTag =
      axis.load_bearing_rank <= 5
        ? `load-bearing · rank ${axis.load_bearing_rank}`
        : `refining · rank ${axis.load_bearing_rank}`;

    lines.push(`### ${label.title} _(${rankTag})_`);
    lines.push(`Axis id: \`${axis.id}\` — technical term: ${label.technical_term}`);

    if (!claim) {
      lines.push(`- Position: _not derived_`);
      lines.push('');
      continue;
    }

    const lowConf = claim.content.confidence < 0.6;
    if (lowConf && claim.content.candidateA && claim.content.candidateB) {
      lines.push(`- Position: _evidence is thin — two plausible reads_`);
      lines.push(
        `  - A · \`${claim.content.candidateA.position}\` → ${claim.content.candidateA.implication}`
      );
      lines.push(
        `  - B · \`${claim.content.candidateB.position}\` → ${claim.content.candidateB.implication}`
      );
      if (claim.content.disambiguatingQuestion) {
        lines.push(`  - Disambiguating question: ${claim.content.disambiguatingQuestion}`);
      }
    } else {
      lines.push(
        `- Position: \`${claim.content.position}\` ${tag(claim.provenance)} _(confidence ${claim.content.confidence.toFixed(2)})_`
      );
    }

    if (claim.content.deviation) {
      lines.push(
        `- Deviation: ${claim.content.deviation.hotProblem} _(magnitude ${claim.content.deviation.magnitude.toFixed(2)})_`
      );
    }

    if (claim.content.evidence.length > 0) {
      lines.push(`- Evidence:`);
      for (const ev of claim.content.evidence) {
        const sourceSuffix = ev.source ? ` (${ev.source})` : '';
        lines.push(`  - "${ev.quote.replace(/\n/g, ' ')}" ${tag(ev.provenance)}${sourceSuffix}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

function hardProblemsSection(claims: HardProblemClaim[]): string {
  const hot = claims.filter(c => !c.content.isDormant);
  const dormant = claims.filter(c => c.content.isDormant);

  const lines: string[] = ['## Hard problems'];
  lines.push('');
  lines.push(
    'Computed from the vector via the three-source blend (position + deviation + interaction). The order is the rank — reason from the top.'
  );
  lines.push('');
  lines.push('### Hot — what this structure makes load-bearing');
  if (hot.length === 0) {
    lines.push('');
    lines.push('_None computed yet._');
  } else {
    hot.forEach((c, i) => {
      const sources = c.content.sources?.join('+') ?? 'position';
      const axes = (c.content.voterAxes ?? []).join(', ');
      lines.push('');
      lines.push(`${i + 1}. **${c.content.problemId}** — sources: \`${sources}\` · axes: ${axes}`);
      const firing = c.content.interactionFirings?.[0];
      if (firing) {
        const interactionTag = firing.source === 'declared' ? 'declared interaction' : 'agent-hypothesised interaction';
        lines.push(`   - ${interactionTag} \`${firing.interactionId}\` across ${firing.axes.join(' × ')}.`);
        if (firing.mechanism) {
          lines.push(`   - Mechanism: ${firing.mechanism}`);
        }
      }
      if (c.content.breakdown) {
        lines.push(
          `   - Score breakdown: position=${c.content.breakdown.position}, deviation=${c.content.breakdown.deviation}, interaction=${c.content.breakdown.interaction} → total ${c.content.weight}`
        );
      }
    });
  }

  if (dormant.length > 0) {
    lines.push('');
    lines.push('### Dormant — what to ignore for this shape');
    lines.push('');
    lines.push(`These matter for other shapes, not this one: ${dormant.map(c => `\`${c.content.problemId}\``).join(', ')}.`);
  }
  return lines.join('\n');
}

function deviationsInteractionsSection(
  axes: AxisPositionClaim[],
  hardProblems: HardProblemClaim[],
  ontology: Ontology
): string {
  const lines: string[] = ['## Deviations and interactions'];
  lines.push('');
  lines.push(
    'The signals that take this company off the typical pattern for its shape. These are what make the diagnosis specific.'
  );

  const deviations = axes.filter(c => c.content.deviation);
  lines.push('');
  lines.push('### Deviations');
  if (deviations.length === 0) {
    lines.push('');
    lines.push('_No atypical positions flagged._');
  } else {
    lines.push('');
    for (const c of deviations) {
      const label = getAxisLabel(c.content.axisId, c.content.axisId);
      const dev = c.content.deviation!;
      lines.push(
        `- **${label.title}** _(${c.content.axisId})_ — position \`${c.content.position}\` · deviation magnitude ${dev.magnitude.toFixed(2)} ${tag('agent_hypothesis')}`
      );
      lines.push(`  - Makes load-bearing: ${dev.hotProblem}`);
    }
  }

  // Pull unique interaction firings off the hot list.
  const seen = new Set<string>();
  const firings: Array<{
    interactionId: string;
    axes: string[];
    mechanism: string;
    source: 'declared' | 'agent_hypothesis';
    hotProblem: string;
  }> = [];
  for (const hp of hardProblems) {
    if (hp.content.isDormant) continue;
    for (const f of hp.content.interactionFirings ?? []) {
      if (seen.has(f.interactionId)) continue;
      seen.add(f.interactionId);
      firings.push({
        interactionId: f.interactionId,
        axes: f.axes,
        mechanism: f.mechanism,
        source: f.source,
        hotProblem: hp.content.problemId
      });
    }
  }

  lines.push('');
  lines.push('### Firing interactions');
  if (firings.length === 0) {
    lines.push('');
    lines.push('_No compounding interactions fired._');
  } else {
    lines.push('');
    for (const f of firings) {
      const provTag = f.source === 'declared' ? '[declared interaction]' : tag('agent_hypothesis');
      lines.push(`- \`${f.interactionId}\` ${provTag} — axes: ${f.axes.join(' × ')}`);
      lines.push(`  - Hot problem: ${f.hotProblem}`);
      if (f.mechanism) lines.push(`  - Mechanism: ${f.mechanism}`);
      const declared = ontology.interactions?.find(i => i.id === f.interactionId);
      if (declared?.predicts) {
        lines.push(`  - Predicts: ${declared.predicts}`);
      }
    }
  }

  return lines.join('\n');
}

function factsSection(facts: FactClaim[]): string {
  const lines: string[] = ['## Raw facts'];
  lines.push('');
  lines.push(
    'The bottom layer. Use these to ground specific answers; if a question needs information not here, say so — do not invent.'
  );
  lines.push('');
  if (facts.length === 0) {
    lines.push('_None recorded._');
    return lines.join('\n');
  }
  for (const f of facts) {
    const src = f.content.source ? ` (${f.content.source})` : '';
    lines.push(`- ${f.content.statement} ${tag(f.provenance)}${src}`);
  }
  return lines.join('\n');
}

function footerBlock(): string {
  return [
    '---',
    '',
    "_Generated by Throughline. Each claim carries its provenance. Hypotheses are flagged — don't promote them._"
  ].join('\n');
}
