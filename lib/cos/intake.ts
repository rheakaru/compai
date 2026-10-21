import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, parseJsonLoose } from '@/lib/rhai/server';
import { modelFor } from '@/lib/rhai/models';
import { buildInterviewSystemPrompt } from './prompt';
import { allSectionsFilled, type CosAgent, type CosSpec } from './types';

// One interview turn: the person's (possibly rambling, voice-transcribed)
// answer -> a patch to the structured spec + the next question. Same primitive
// as the marketing ontology intake: parse, reflect, push, move on.

export interface IntakeTurn {
  reply: string;
  patch: Partial<CosSpec>;
  done: boolean;
}

export async function runIntakeTurn(agent: CosAgent, text: string): Promise<IntakeTurn> {
  const prior: Anthropic.Messages.MessageParam[] = agent.interview
    .slice(-16)
    .map(m => ({ role: m.role === 'agent' ? ('assistant' as const) : ('user' as const), content: m.text }));

  const msg = await anthropic().messages.create({
    model: modelFor('cosIntake'),
    max_tokens: 900,
    system: buildInterviewSystemPrompt(agent),
    messages: [...prior, { role: 'user', content: text }],
    ...({ output_config: { effort: 'low' } } as object)
  });
  const raw = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  let parsed: Partial<IntakeTurn> = {};
  try {
    parsed = parseJsonLoose<Partial<IntakeTurn>>(raw);
  } catch {
    // Model drifted off JSON — keep the conversation alive with the raw text.
    return { reply: raw.trim().slice(0, 600) || 'Got it — tell me more?', patch: {}, done: false };
  }
  const patch = sanitizePatch(parsed.patch ?? {});
  const merged = mergeSpec(agent.spec, patch);
  return {
    reply: String(parsed.reply ?? '').trim().slice(0, 800) || 'Got it.',
    patch,
    done: parsed.done === true && allSectionsFilled(merged)
  };
}

const TEXT_KEYS = ['agentName', 'role', 'objective', 'knows', 'cadence', 'tools', 'voice', 'rules'] as const;

function sanitizePatch(p: Record<string, unknown>): Partial<CosSpec> {
  const out: Partial<CosSpec> = {};
  for (const k of TEXT_KEYS) {
    const v = p[k];
    if (typeof v === 'string' && v.trim()) (out as Record<string, unknown>)[k] = v.trim().slice(0, k === 'agentName' ? 40 : 2000);
  }
  const tf = p.toolFlags as Record<string, unknown> | undefined;
  if (tf && typeof tf === 'object') {
    const flags: Partial<CosSpec['toolFlags']> = {};
    for (const k of ['calendarRead', 'calendarWrite', 'gmailRead', 'reminders'] as const) {
      if (typeof tf[k] === 'boolean') flags[k] = tf[k] as boolean;
    }
    if (Object.keys(flags).length) out.toolFlags = flags as CosSpec['toolFlags'];
  }
  return out;
}

/** Text fields replace (the model is told to carry forward); flags merge. */
export function mergeSpec(spec: CosSpec, patch: Partial<CosSpec>): CosSpec {
  const { toolFlags, ...rest } = patch;
  return {
    ...spec,
    ...rest,
    toolFlags: { ...spec.toolFlags, ...(toolFlags ?? {}) }
  };
}
