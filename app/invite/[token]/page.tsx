import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase/admin';
import type { InviteIndexDoc, RoleClaim, RoleDoc } from '@/lib/model/role';
import type { BrandingSnapshot, CompanyDoc } from '@/lib/model/claims';
import { InvitedRoleClient } from '@/components/InvitedRoleClient';

export const dynamic = 'force-dynamic';

export default async function InvitePage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = adminDb();
  const idxSnap = await db.collection('inviteIndex').doc(token).get();
  if (!idxSnap.exists) notFound();
  const idx = idxSnap.data() as InviteIndexDoc;

  const roleSnap = await db
    .collection('companies')
    .doc(idx.companyId)
    .collection('roles')
    .doc(idx.roleId)
    .get();
  if (!roleSnap.exists) notFound();
  const role = roleSnap.data() as RoleDoc;

  const companySnap = await db.collection('companies').doc(idx.companyId).get();
  const company = companySnap.exists ? (companySnap.data() as CompanyDoc) : null;

  // If the role has been completed, load its claims so the invitee can revisit
  // their own career strategy. Note: the server reads these via Admin SDK; the
  // client never reads /claims directly (security rules block that for anyone
  // but the invitee themselves — and only after they sign in).
  let claims: RoleClaim[] = [];
  if (role.status === 'completed') {
    const claimsSnap = await db
      .collection('companies')
      .doc(idx.companyId)
      .collection('roles')
      .doc(idx.roleId)
      .collection('claims')
      .get();
    claims = claimsSnap.docs.map(d => d.data() as RoleClaim);
  }

  return (
    <InvitedRoleClient
      token={token}
      roleTitle={role.roleTitle}
      status={role.status}
      companyName={company?.name ?? null}
      companyUrl={company?.url ?? null}
      branding={company?.branding ?? (null as BrandingSnapshot | null)}
      initialClaims={claims}
    />
  );
}
