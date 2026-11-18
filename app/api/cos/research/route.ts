import { NextRequest } from 'next/server';
import { requireCosUser } from '@/lib/cos/auth';
import { getOrCreateAgent, saveAndRecompile } from '@/lib/cos/store';
import { researchPerson } from '@/lib/cos/web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_RUNS = 4;

// "Look me up": a web search on the participant. Returns facts as `pending`;
// the person ticks yes/no on the page (saved through PATCH /api/cos), and only
// the yeses reach agent.md. Facts they already decided on are kept; a re-run
// replaces only the undecided ones.

export async function POST(req: NextRequest) {
  const user = await requireCosUser(req);
  if (user instanceof Response) return user;
  const agent = await getOrCreateAgent(user.uid, user.email ?? '', '');
  if (agent.profile.name.trim().length < 2) return new Response('Add your name first.', { status: 400 });
  if (agent.usage.research >= MAX_RUNS) {
    return new Response('That is all the searching we can do for now — add anything missing in your brief.', { status: 429 });
  }
  let found;
  try {
    found = await researchPerson(agent);
  } catch {
    return new Response('The search did not go through — try again in a moment.', { status: 502 });
  }
  const decided = agent.profile.facts.filter(f => f.status !== 'pending');
  const seen = new Set(decided.map(f => f.text.toLowerCase()));
  const facts = [...decided, ...found.filter(f => !seen.has(f.text.toLowerCase()))].slice(0, 30);
  const saved = await saveAndRecompile(user.uid, {
    profile: { ...agent.profile, facts },
    usage: { ...agent.usage, research: agent.usage.research + 1 }
  });
  return Response.json({ facts: saved.profile.facts, found: found.length, runsLeft: MAX_RUNS - saved.usage.research });
}
