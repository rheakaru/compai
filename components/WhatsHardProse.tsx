'use client';

import type { AxisPositionClaim, HardProblemClaim } from '@/lib/model/claims';
import type { Ontology } from '@/lib/ontology/types';
import { getAxisLabel } from '@/lib/ontology/display-labels';

/**
 * "What's hard" rendered as a paragraph in the same voice as the cards
 * below. Purely a rendering pass over the existing hot-problem ranking —
 * names the top 1–2 problems, explains why they're load-bearing FOR THIS
 * SHAPE using the interaction mechanisms / axis sources the engine
 * already produced.
 */
export function WhatsHardProse({
  hotProblems,
  axisClaims,
  ontology
}: {
  hotProblems: HardProblemClaim[];
  axisClaims: AxisPositionClaim[];
  ontology: Ontology;
}) {
  void axisClaims; // reserved for future axis-detail mentions
  void ontology;

  const live = hotProblems
    .filter(p => !p.content.isDormant)
    .sort((a, b) => b.content.weight - a.content.weight);

  if (live.length === 0) {
    return (
      <p className="text-[15px] italic leading-relaxed text-ink-500">
        Not enough signal yet to name what&apos;s hard. Correcting a card or adding context
        sharpens this section.
      </p>
    );
  }

  const top = live[0];
  const second = live[1];

  const sentences: string[] = [];

  // First sentence: name the top problem in plain language.
  const topName = prettify(top.content.problemId);
  const topFiring = top.content.interactionFirings?.[0];
  const topAxisHandles = uniqueHandles(top.content.voterAxes ?? []);

  if (topFiring && topFiring.mechanism) {
    // Interaction-driven — the mechanism is already prose. Lead with it.
    sentences.push(`The hard thing for a shape like yours is ${strip(topName)}.`);
    sentences.push(cleanMechanism(topFiring.mechanism));
  } else if ((top.content.sources ?? []).includes('deviation')) {
    sentences.push(
      `What sits load-bearing for this shape is ${strip(topName)} — your position on ${listJoin(
        topAxisHandles
      )} puts you off the typical pattern, and the typical playbook for that position is not enough to absorb it.`
    );
  } else {
    sentences.push(
      `What sits load-bearing for this shape is ${strip(topName)}${
        topAxisHandles.length > 0
          ? ` — driven by where you sit on ${listJoin(topAxisHandles)}.`
          : '.'
      }`
    );
  }

  // Optional follow-on: name the second problem if it's meaningfully behind
  // (avoid mentioning two near-identical problems).
  if (second) {
    const secondName = prettify(second.content.problemId);
    const secondFiring = second.content.interactionFirings?.[0];
    const secondHandles = uniqueHandles(second.content.voterAxes ?? []);
    if (secondFiring?.mechanism) {
      sentences.push(
        `Right behind it sits ${strip(secondName)} — ${shorten(
          cleanMechanism(secondFiring.mechanism)
        )}`
      );
    } else if (secondHandles.length > 0) {
      sentences.push(
        `Right behind it: ${strip(secondName)}, from ${listJoin(secondHandles)}.`
      );
    } else {
      sentences.push(`Right behind it: ${strip(secondName)}.`);
    }
  }

  // Close: what this implies for where energy goes.
  sentences.push(
    'Everything that widens the slack on those two — that’s leverage. Everything else, on a shape like yours, is noise.'
  );

  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-ink-800">
      <p>{sentences.join(' ')}</p>
    </div>
  );
}

function prettify(id: string): string {
  return id.replace(/_/g, ' ');
}

function strip(s: string): string {
  // Strip a trailing period if the source has one; we add our own punctuation.
  return s.replace(/[.\s]+$/, '');
}

function uniqueHandles(axisIds: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of axisIds) {
    const handle = getAxisLabel(id, id).handle?.toLowerCase() || id.replace(/_/g, ' ');
    if (seen.has(handle)) continue;
    seen.add(handle);
    out.push(handle);
    if (out.length >= 2) break;
  }
  return out;
}

function listJoin(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
}

function cleanMechanism(s: string): string {
  // Mechanisms in the ontology sometimes have an internal newline / extra
  // whitespace; collapse to clean prose.
  let out = s.replace(/\s+/g, ' ').trim();
  if (!/[.!?]$/.test(out)) out += '.';
  return out;
}

function shorten(s: string): string {
  // For the second problem we want a tighter clause, not the full mechanism.
  // Take the first clause / sentence.
  const m = s.match(/^([^.!?]+[.!?])/);
  if (!m) return s;
  const first = m[1].trim();
  // lowercase the leading character to make it read as a continuation
  return first.charAt(0).toLowerCase() + first.slice(1);
}
