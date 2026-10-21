import { NextRequest } from 'next/server';
import { requireCosUser } from '@/lib/cos/auth';
import { getOrCreateAgent, saveAgent } from '@/lib/cos/store';
import { compileAgentMd } from '@/lib/cos/prompt';
import { recentTurns } from '@/lib/cos/agent';
import { googleConfigured } from '@/lib/cos/google';
import type { CosAgent, CosProfile, CosSpec } from '@/lib/cos/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET  — load (or create) my agent + what the page needs to render.
// PATCH — autosave. Accepts any subset of { profile, spec, step, agentMd,
//         agentMdEdited, status }. Each save recompiles agent.md unless the
//         person has taken over the text by hand.

export async function GET(req: NextRequest) {
  const user = await requireCosUser(req);
  if (user instanceof Response) return user;
  const agent = await getOrCreateAgent(user.uid, user.email ?? '', '');
  const turns = await recentTurns(user.uid, 20);
  return Response.json({
    agent: publicView(agent),
    turns,
    whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '',
    googleAvailable: googleConfigured()
  });
}

export async function PATCH(req: NextRequest) {
  const user = await requireCosUser(req);
  if (user instanceof Response) return user;
  const body = (await req.json().catch(() => ({}))) as Partial<CosAgent>;
  const current = await getOrCreateAgent(user.uid, user.email ?? '', '');

  const patch: Partial<CosAgent> = {};
  if (body.profile) patch.profile = cleanProfile({ ...current.profile, ...body.profile });
  if (body.spec) patch.spec = cleanSpec({ ...current.spec, ...body.spec, toolFlags: { ...current.spec.toolFlags, ...(body.spec.toolFlags ?? {}) } });
  if (typeof body.step === 'number') patch.step = Math.max(0, Math.min(6, Math.round(body.step)));
  if (typeof body.agentMdEdited === 'boolean') patch.agentMdEdited = body.agentMdEdited;
  if (typeof body.agentMd === 'string') patch.agentMd = body.agentMd.slice(0, 20_000);
  if (body.status === 'draft' || body.status === 'live') patch.status = body.status;
  if (body.interviewDone === true || body.interviewDone === false) patch.interviewDone = body.interviewDone;

  // Keep the compiled document current unless they own the text now.
  const edited = patch.agentMdEdited ?? current.agentMdEdited;
  if (!edited) {
    patch.agentMd = compileAgentMd({
      profile: patch.profile ?? current.profile,
      spec: patch.spec ?? current.spec,
      memory: current.memory
    });
  }

  const saved = await saveAgent(user.uid, patch);
  return Response.json({ agent: publicView(saved) });
}

function cleanProfile(p: CosProfile): CosProfile {
  return {
    name: String(p.name ?? '').trim().slice(0, 80),
    phone: String(p.phone ?? '').trim().slice(0, 30),
    phoneDigits: '', // recomputed in saveAgent
    bio: String(p.bio ?? '').slice(0, 6000),
    links: (Array.isArray(p.links) ? p.links : [])
      .map(l => String(l).trim())
      .filter(Boolean)
      .slice(0, 8)
      .map(l => l.slice(0, 200))
  };
}

function cleanSpec(s: CosSpec): CosSpec {
  const t = (v: unknown, n: number) => String(v ?? '').slice(0, n);
  return {
    agentName: t(s.agentName, 40).trim(),
    role: t(s.role, 2000),
    objective: t(s.objective, 2000),
    knows: t(s.knows, 4000),
    cadence: t(s.cadence, 2000),
    tools: t(s.tools, 2000),
    toolFlags: {
      calendarRead: s.toolFlags?.calendarRead !== false,
      calendarWrite: s.toolFlags?.calendarWrite !== false,
      gmailRead: s.toolFlags?.gmailRead !== false,
      reminders: s.toolFlags?.reminders !== false
    },
    voice: t(s.voice, 2000),
    rules: t(s.rules, 3000)
  };
}

/** Everything in the doc is the person's own — nothing secret lives here. */
function publicView(a: CosAgent): CosAgent {
  return a;
}
