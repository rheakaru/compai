import { NextRequest } from 'next/server';
import { requireCosUser } from '@/lib/cos/auth';
import { getOrCreateAgent, saveAgent } from '@/lib/cos/store';
import { mergeSpec, runIntakeTurn } from '@/lib/cos/intake';
import { INTERVIEW_OPENING, compileAgentMd } from '@/lib/cos/prompt';
import type { CosMessage } from '@/lib/cos/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_USER_TURNS = 24;
const MAX_CHARS = 4000;

// The guided design interview. `start` seeds the opening question (no model
// call); `message` runs one turn, patches the spec, and persists both the
// transcript and the spec so a reload picks up exactly where they were.
// `restart` wipes the transcript but keeps whatever spec they had.

export async function POST(req: NextRequest) {
  const user = await requireCosUser(req);
  if (user instanceof Response) return user;
  const body = (await req.json().catch(() => ({}))) as {
    action?: 'start' | 'message' | 'restart';
    text?: string;
    audioUrl?: string;
  };
  const agent = await getOrCreateAgent(user.uid, user.email ?? '', '');

  if (body.action === 'start' || body.action === 'restart') {
    if (body.action === 'start' && agent.interview.length) {
      return Response.json({ messages: agent.interview, spec: agent.spec, done: agent.interviewDone });
    }
    const opening: CosMessage = {
      role: 'agent',
      text: INTERVIEW_OPENING(agent.profile.name, agent.spec.agentName),
      at: Date.now()
    };
    const saved = await saveAgent(user.uid, { interview: [opening], interviewDone: false });
    return Response.json({ messages: saved.interview, spec: saved.spec, done: false });
  }

  if (body.action === 'message') {
    const text = String(body.text ?? '').trim().slice(0, MAX_CHARS);
    if (!text) return new Response('expected text', { status: 400 });
    const userTurns = agent.interview.filter(m => m.role === 'user').length;
    if (userTurns >= MAX_USER_TURNS) return new Response('That is plenty — head to the review step.', { status: 429 });

    const turn = await runIntakeTurn(agent, text);
    const spec = mergeSpec(agent.spec, turn.patch);
    const now = Date.now();
    const audioUrl =
      body.audioUrl && /^https:\/\/storage\.googleapis\.com\/[^"'\s]+$/.test(body.audioUrl) ? body.audioUrl.slice(0, 500) : undefined;
    const interview: CosMessage[] = [
      ...agent.interview,
      { role: 'user', text, at: now, ...(audioUrl ? { audioUrl } : {}) },
      { role: 'agent', text: turn.reply, at: now }
    ];
    const patch = {
      interview,
      spec,
      interviewDone: turn.done || agent.interviewDone,
      ...(agent.agentMdEdited ? {} : { agentMd: compileAgentMd({ profile: agent.profile, spec, memory: agent.memory }) })
    };
    await saveAgent(user.uid, patch);
    return Response.json({ reply: turn.reply, spec, done: patch.interviewDone });
  }

  return new Response('unknown action', { status: 400 });
}
