import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { loadCompanyForAccess } from '@/lib/model/access';
import type { CareerStrategyClaim, RoleDoc } from '@/lib/model/role';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Returns the latest career_strategy claim for a given role.
 *
 * TRUST-INVARIANT CHANGE: The original build prompt promised invitees that
 * the inviter would only see aggregate patterns, never individual answers.
 * The user explicitly requested that the inviter see the career strategy,
 * so this endpoint exposes it. The invitee-facing copy on /invite/[token]
 * has been updated to reflect this honestly.
 *
 * Per-activity claims (role_activity) remain invitee-only — the raw quotes
 * from the description are NOT exposed. Only the polished career strategy.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ companyId: string; roleId: string }> }
) {
  const sessionId = await getOrCreateSessionId();
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) return json({ error: 'auth_required' }, 401);

  const { companyId, roleId } = await ctx.params;
  const access = await loadCompanyForAccess({
    companyId,
    uid: user.uid,
    sessionId
  });
  if (!access) return json({ error: 'company not found' }, 404);
  if (!access.canEdit) return json({ error: 'forbidden' }, 403);

  const db = adminDb();
  const roleRef = db
    .collection('companies')
    .doc(companyId)
    .collection('roles')
    .doc(roleId);
  const roleSnap = await roleRef.get();
  if (!roleSnap.exists) return json({ error: 'role not found' }, 404);
  const role = roleSnap.data() as RoleDoc;

  const claimsSnap = await roleRef.collection('claims').get();
  const strategy = claimsSnap.docs
    .map(d => d.data() as CareerStrategyClaim | { kind: string; supersededBy: string | null })
    .filter(
      (c): c is CareerStrategyClaim =>
        c.kind === 'career_strategy' && c.supersededBy === null
    )
    .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;

  return json({
    role: {
      roleId: role.roleId,
      roleTitle: role.roleTitle,
      status: role.status,
      inviteeEmail: role.inviteeEmail,
      sourceOfTruthDoc: role.sourceOfTruthDoc ?? null,
      completedAt: role.completedAt
    },
    strategy: strategy?.content ?? null
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
