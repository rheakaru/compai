import 'server-only';
import type { NextRequest } from 'next/server';
import { adminAuth } from './admin';

/**
 * Operator session cookie — a server-minted Firebase session cookie that
 * survives Safari/iOS ITP evicting script-writable storage (which wipes the
 * client SDK's indexedDB persistence after ~7 days and kept logging Rhea out).
 * httpOnly + Secure + SameSite=Lax, 14-day max age (Firebase's maximum),
 * renewed on a rolling basis by AuthProvider. Only ever minted for users with
 * the operator custom claim — public diagnosis visitors never get one.
 */
export const SESSION_COOKIE = '__rhai_session';

// ---------------------------------------------------------------------------
// Login domain restriction. Only @heyrhai.com accounts (plus an explicit
// exception list) may hold operator/finance/ea access — even if they carry the
// custom claim. Rhea's operator account is rhea@rosebazaar.in, so it is
// allow-listed here (and via OPERATOR_EMAIL_EXCEPTIONS) to avoid locking her
// out; drop it once every operator has a heyrhai.com account.
// ---------------------------------------------------------------------------
const ALLOWED_DOMAIN = '@heyrhai.com';
const BUILTIN_EXCEPTIONS = ['rhea@rosebazaar.in'];

export function isAllowedOperatorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (e.endsWith(ALLOWED_DOMAIN)) return true;
  const extra = (process.env.OPERATOR_EMAIL_EXCEPTIONS ?? '')
    .split(',')
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);
  return [...BUILTIN_EXCEPTIONS, ...extra].includes(e);
}

/** Zero out privileged roles when the email's domain isn't allowed to log in. */
function gateByDomain(u: AuthedUser): AuthedUser {
  if (isAllowedOperatorEmail(u.email)) return u;
  return { ...u, operator: false, finance: false, ea: false };
}

export interface AuthedUser {
  uid: string;
  email: string | null;
  operator: boolean;
  /** Accounts-only role: Invoices/Accounting/Docs/NDA + read-only pipeline. */
  finance: boolean;
  /** EA role (Divya): session logistics only — venue, timings, cars, travel. */
  ea: boolean;
}

export async function verifyIdToken(token: string): Promise<AuthedUser> {
  const decoded = await adminAuth().verifyIdToken(token, true);
  return gateByDomain({
    uid: decoded.uid,
    email: typeof decoded.email === 'string' ? decoded.email : null,
    operator: decoded.operator === true,
    finance: decoded.finance === true,
    ea: decoded.ea === true
  });
}

export async function getUserFromAuthHeader(authHeader: string | null): Promise<AuthedUser | null> {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/.exec(authHeader);
  if (!m) return null;
  try {
    return await verifyIdToken(m[1]);
  } catch {
    return null;
  }
}

/** Verify the operator session cookie. Throws when invalid/expired/revoked. */
export async function verifySessionCookie(cookie: string): Promise<AuthedUser> {
  const decoded = await adminAuth().verifySessionCookie(cookie, true);
  return gateByDomain({
    uid: decoded.uid,
    email: typeof decoded.email === 'string' ? decoded.email : null,
    operator: decoded.operator === true,
    finance: decoded.finance === true,
    ea: decoded.ea === true
  });
}

/**
 * Resolve the caller from a request: bearer ID token first (cheaper, and what
 * every existing client sends), then the `__rhai_session` cookie as fallback
 * for when client-side Firebase storage has been evicted.
 */
export async function getUserFromRequest(req: NextRequest): Promise<AuthedUser | null> {
  const fromHeader = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (fromHeader) return fromHeader;
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    return await verifySessionCookie(cookie);
  } catch {
    return null;
  }
}
