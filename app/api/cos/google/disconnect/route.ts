import { NextRequest } from 'next/server';
import { requireCosUser } from '@/lib/cos/auth';
import { revokeToken } from '@/lib/cos/google';
import { clearGoogle } from '@/lib/cos/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Revoke at Google and forget the token. Their agent loses calendar/email access immediately. */
export async function POST(req: NextRequest) {
  const user = await requireCosUser(req);
  if (user instanceof Response) return user;
  await revokeToken(user.uid);
  await clearGoogle(user.uid);
  return Response.json({ ok: true });
}
