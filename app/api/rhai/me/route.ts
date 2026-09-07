import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/firebase/auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Who am I, role-wise — drives which tabs the workspace shows. */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return new Response('unauthorized', { status: 401 });
  return Response.json({
    uid: user.uid,
    email: user.email,
    operator: user.operator,
    finance: user.finance,
    ea: user.ea,
    hire: user.hire
  });
}
