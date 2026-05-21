import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import type { BrandingSnapshot, CompanyDoc } from '@/lib/model/claims';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PersistedCompany extends Omit<CompanyDoc, 'branding'> {
  branding?: BrandingSnapshot | null;
}

/**
 * Returns the current signed-in user's companies. Powers the
 * "continue where you left off" list on the landing page.
 *
 * Lightweight projection — only the fields the landing UI needs.
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) return json({ companies: [] });

  const snap = await adminDb()
    .collection('companies')
    .where('ownerUid', '==', user.uid)
    .limit(50)
    .get();

  const companies = snap.docs
    .map(d => {
      const c = d.data() as PersistedCompany;
      return {
        id: d.id,
        url: c.url,
        name: c.branding?.name ?? c.name ?? null,
        logoUrl: c.branding?.logoUrl ?? null,
        accentColor: c.branding?.accentColor ?? null,
        createdAt: c.createdAt,
        completedAt: c.completedAt ?? null,
        lockedAt: c.lockedAt ?? null
      };
    })
    .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt));

  return json({ companies });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
