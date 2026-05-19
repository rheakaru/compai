import { NextRequest } from 'next/server';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { loadCompanyForAccess } from '@/lib/model/access';
import { computeRoleAggregate } from '@/lib/role/aggregate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ companyId: string }> }
) {
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) return new Response('unauthorized', { status: 401 });

  const sessionId = await getOrCreateSessionId();
  const { companyId } = await ctx.params;
  const access = await loadCompanyForAccess({
    companyId,
    uid: user.uid,
    sessionId
  });
  if (!access) return new Response('not found', { status: 404 });
  if (!access.canEdit) return new Response('forbidden', { status: 403 });

  const aggregate = await computeRoleAggregate(companyId);
  return new Response(JSON.stringify(aggregate), {
    headers: { 'content-type': 'application/json' }
  });
}
