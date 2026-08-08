import { NextRequest } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import {
  SESSION_COOKIE,
  getUserFromAuthHeader,
  verifySessionCookie
} from '@/lib/firebase/auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Firebase's maximum session-cookie lifetime. AuthProvider re-POSTs at most
// once a day while Rhea has a live Firebase user, so the cookie rolls forward
// and effectively never expires as long as she keeps visiting.
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function sessionCookie(value: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${value}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

/** Mint the session cookie from a fresh bearer ID token. Operator or finance. */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const user = await getUserFromAuthHeader(authHeader);
  if (!user) return new Response('unauthorized', { status: 401 });
  if (!user.operator && !user.finance) {
    return new Response('forbidden — operator only', { status: 403 });
  }

  // getUserFromAuthHeader already validated the Bearer shape + token.
  const idToken = /^Bearer\s+(.+)$/.exec(authHeader ?? '')![1];
  const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_TTL_MS });

  return new Response(JSON.stringify({ ok: true, email: user.email }), {
    headers: {
      'content-type': 'application/json',
      'set-cookie': sessionCookie(cookie, SESSION_TTL_MS / 1000)
    }
  });
}

/** Report whether the session cookie is still a valid operator session. */
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return new Response('unauthorized', { status: 401 });
  try {
    const user = await verifySessionCookie(cookie);
    if (!user.operator && !user.finance) {
      return new Response('forbidden — operator only', { status: 403 });
    }
    return Response.json({ user: { uid: user.uid, email: user.email } });
  } catch {
    return new Response('unauthorized', { status: 401 });
  }
}

/** Sign-out: clear the session cookie. */
export async function DELETE() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'content-type': 'application/json',
      'set-cookie': sessionCookie('', 0)
    }
  });
}
