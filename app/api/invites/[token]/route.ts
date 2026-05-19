import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import type { InviteIndexDoc, RoleDoc } from '@/lib/model/role';
import type { CompanyDoc, BrandingSnapshot } from '@/lib/model/claims';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const db = adminDb();
  const idxSnap = await db.collection('inviteIndex').doc(token).get();
  if (!idxSnap.exists) return new Response('not found', { status: 404 });
  const idx = idxSnap.data() as InviteIndexDoc;

  const roleSnap = await db
    .collection('companies')
    .doc(idx.companyId)
    .collection('roles')
    .doc(idx.roleId)
    .get();
  if (!roleSnap.exists) return new Response('not found', { status: 404 });
  const role = roleSnap.data() as RoleDoc;

  const companySnap = await db.collection('companies').doc(idx.companyId).get();
  const company = companySnap.exists ? (companySnap.data() as CompanyDoc) : null;

  return new Response(
    JSON.stringify({
      role: {
        roleTitle: role.roleTitle,
        status: role.status,
        completedAt: role.completedAt
      },
      company: company
        ? {
            url: company.url,
            name: company.name,
            branding: company.branding ?? (null as BrandingSnapshot | null)
          }
        : null
    }),
    { headers: { 'content-type': 'application/json' } }
  );
}
