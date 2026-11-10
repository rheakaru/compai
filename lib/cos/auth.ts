import 'server-only';
import type { NextRequest } from 'next/server';
import { getUserFromRequest, type AuthedUser } from '@/lib/firebase/auth-server';

/**
 * Any signed-in Google account may build a chief of staff — this is a public
 * product, not the operator dashboard. The bearer ID token is the only thing
 * we trust (or, for an operator whose client storage was evicted, the
 * __rhai_session cookie); the uid scopes every read and write to that person.
 */
export async function requireCosUser(req: NextRequest): Promise<AuthedUser | Response> {
  const user = await getUserFromRequest(req);
  if (!user) return new Response('sign in first', { status: 401 });
  return user;
}
