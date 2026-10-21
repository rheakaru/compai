import { NextRequest } from 'next/server';
import { requireCosUser } from '@/lib/cos/auth';
import { getAgent } from '@/lib/cos/store';
import { buildCosReply, recentTurns } from '@/lib/cos/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// The web test console — same brain and memory as WhatsApp, so what they try
// here carries over. Useful in the room when someone's WhatsApp isn't matching
// or the mobile data is bad.

export async function GET(req: NextRequest) {
  const user = await requireCosUser(req);
  if (user instanceof Response) return user;
  return Response.json({ turns: await recentTurns(user.uid, 30) });
}

export async function POST(req: NextRequest) {
  const user = await requireCosUser(req);
  if (user instanceof Response) return user;
  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = String(body.text ?? '').trim().slice(0, 4000);
  if (!text) return new Response('expected text', { status: 400 });
  const agent = await getAgent(user.uid);
  if (!agent) return new Response('no agent yet', { status: 404 });
  const reply = await buildCosReply({ agent, text, channel: 'web' });
  return Response.json({ reply });
}
