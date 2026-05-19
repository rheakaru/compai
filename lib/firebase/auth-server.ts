import 'server-only';
import { adminAuth } from './admin';

export interface AuthedUser {
  uid: string;
  email: string | null;
  operator: boolean;
}

export async function verifyIdToken(token: string): Promise<AuthedUser> {
  const decoded = await adminAuth().verifyIdToken(token, true);
  return {
    uid: decoded.uid,
    email: typeof decoded.email === 'string' ? decoded.email : null,
    operator: decoded.operator === true
  };
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
