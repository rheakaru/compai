import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { parseJsonLoose } from '@/lib/rhai/server';
import { fetchSiteText, loadMyCompany, requireUser, runHire } from '@/lib/hire/server';
import { COL_HIRE_COMPANIES, type HireCompany } from '@/lib/hire/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// The caller's company profile. One company per signed-in account (v1).

export async function GET(req: NextRequest) {
  const { user, error } = await requireUser(req);
  if (error) return error;
  const company = await loadMyCompany(user!.uid);
  if (!company) return new Response('no company yet', { status: 404 });
  return Response.json({ company });
}

// PUT { name, website?, about } — upsert + re-structure the profile.
export async function PUT(req: NextRequest) {
  const { user, error } = await requireUser(req);
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as { name?: string; website?: string; about?: string };
  const name = body.name?.trim().slice(0, 120);
  const website = body.website?.trim().slice(0, 200);
  const about = body.about?.trim().slice(0, 8000);
  if (!name || !about || about.length < 40) {
    return new Response('Give the company a name and at least a few sentences about it.', { status: 400 });
  }

  // Structure the profile: website text + the founder's rough words → a
  // public-safe brief Rhai uses inside interviews, plus info gaps.
  const siteText = website ? await fetchSiteText(website) : '';
  let profile = '';
  let gaps: string[] = [];
  try {
    const raw = await runHire({
      system:
        'You help a company set up AI-conducted job interviews. From their website text and their own rough description, write the company brief the AI interviewer will use. Return ONLY JSON.',
      user: [
        `COMPANY NAME: ${name}`,
        website ? `WEBSITE: ${website}` : '',
        siteText ? `\nWEBSITE TEXT (scraped):\n${siteText}` : '',
        `\nTHE FOUNDER'S OWN DESCRIPTION (typed or voice-transcribed — read for meaning):\n${about}`,
        '',
        'Return ONLY JSON:',
        '{"profile": "<250-400 word public-safe brief: what the company does, products/services, customers, stage & size if known, how they work, culture signals. Candidates will effectively hear this — no confidential info, no speculation>",',
        ' "gaps": ["<up to 4 short questions for the OWNER about missing info that would make interviews better (team size, location policy, growth stage…)>"]}'
      ]
        .filter(Boolean)
        .join('\n'),
      maxTokens: 1500
    });
    const parsed = parseJsonLoose<{ profile?: string; gaps?: string[] }>(raw);
    profile = String(parsed.profile ?? '').slice(0, 4000);
    gaps = (parsed.gaps ?? []).map(g => String(g).slice(0, 200)).slice(0, 4);
  } catch {
    profile = about; // fail-soft: interviews use the raw description
  }

  const now = Date.now();
  const ref = adminDb().collection(COL_HIRE_COMPANIES).doc(user!.uid);
  const existing = await ref.get();
  const company: Omit<HireCompany, 'id'> = {
    ownerEmail: user!.email ?? '',
    name,
    ...(website ? { website } : {}),
    about,
    profile,
    gaps,
    createdAt: existing.exists ? (existing.data() as HireCompany).createdAt : now,
    updatedAt: now
  };
  await ref.set(company, { merge: true });
  return Response.json({ company: { id: user!.uid, ...company } });
}
