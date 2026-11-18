import { NextRequest } from 'next/server';
import { requireCosUser } from '@/lib/cos/auth';
import { getOrCreateAgent, saveAndRecompile } from '@/lib/cos/store';
import { normalizeUrl, readCompanySite } from '@/lib/cos/web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_READS = 6;

// Read the company website and compile a brief (editable on the page).

export async function POST(req: NextRequest) {
  const user = await requireCosUser(req);
  if (user instanceof Response) return user;
  const body = (await req.json().catch(() => ({}))) as { website?: string; name?: string };
  const website = String(body.website ?? '').trim().slice(0, 300);
  const url = normalizeUrl(website);
  if (!url) return new Response('That does not look like a website address.', { status: 400 });
  const agent = await getOrCreateAgent(user.uid, user.email ?? '', '');
  if (agent.usage.siteRead >= MAX_READS) return new Response('That is the limit for reading websites — paste a few lines about the company instead.', { status: 429 });

  const name = String(body.name ?? agent.company.name ?? '').trim().slice(0, 120);
  let result;
  try {
    result = await readCompanySite(url, name);
  } catch (e) {
    await saveAndRecompile(user.uid, { usage: { ...agent.usage, siteRead: agent.usage.siteRead + 1 } });
    return new Response(e instanceof Error ? e.message : 'Could not read that site.', { status: 502 });
  }
  const company = {
    ...agent.company,
    website,
    name: name || result.name,
    siteBrief: result.brief,
    siteReadAt: Date.now()
  };
  const saved = await saveAndRecompile(user.uid, { company, usage: { ...agent.usage, siteRead: agent.usage.siteRead + 1 } });
  return Response.json({ company: saved.company });
}
