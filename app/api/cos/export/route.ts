import { NextRequest } from 'next/server';
import { requireCosUser } from '@/lib/cos/auth';
import { getAgent } from '@/lib/cos/store';
import { buildExportMarkdown } from '@/lib/cos/prompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The take-home .md — agent.md + build instructions for their own Claude Code. */
export async function POST(req: NextRequest) {
  const user = await requireCosUser(req);
  if (user instanceof Response) return user;
  const agent = await getAgent(user.uid);
  if (!agent) return new Response('no agent yet', { status: 404 });
  const md = buildExportMarkdown(agent, { whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER });
  return new Response(md, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="chief-of-staff-${(agent.profile.name || 'me').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md"`
    }
  });
}
