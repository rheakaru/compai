'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { watchAuth, signInWithGoogle, signOut as fbSignOut, getIdToken } from '@/lib/firebase/auth-client';

/**
 * Lightweight operator identity recovered from the httpOnly `__rhai_session`
 * cookie when Firebase's own client storage has been evicted (Safari/iOS ITP
 * wipes script-writable storage after ~7 days, which kept logging Rhea out of
 * /leads). Mirrors the User fields the UI actually reads (email, displayName)
 * so `user.email` / `user?.displayName` keep working; getToken() returns null
 * in this state and useAuthedFetch simply omits the bearer header — the
 * session cookie rides along on same-origin fetches and the operator APIs
 * accept it as fallback.
 */
export interface SessionUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isSessionOnly: true;
}

interface AuthCtx {
  user: User | SessionUser | null;
  loading: boolean;
  signIn: () => Promise<User>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const Ctx = createContext<AuthCtx | null>(null);

// Rolling renewal: the session cookie lives 14 days (Firebase's maximum), and
// we re-mint it from a fresh ID token at most once per day — so it effectively
// never expires while she keeps visiting.
const MINT_TS_KEY = 'rhai_session_minted_at';
const MINT_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function mintSessionCookie(u: User, force = false): Promise<void> {
  try {
    if (!force) {
      const last = Number(localStorage.getItem(MINT_TS_KEY) ?? 0);
      if (Date.now() - last < MINT_INTERVAL_MS) return;
    }
    const token = await u.getIdToken();
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` }
    });
    // 403 = not an operator: public visitors never get a session cookie.
    // Record the attempt either way so we don't re-hit the route every render.
    if (res.ok || res.status === 403) {
      localStorage.setItem(MINT_TS_KEY, String(Date.now()));
    }
  } catch {
    // non-fatal: renewal retries on the next ID-token refresh
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [prevUid, setPrevUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = watchAuth(async u => {
      if (u) {
        setUser(u);
        setLoading(false);
        // Rolling renewal of the operator session cookie (throttled ~24h).
        void mintSessionCookie(u);
        // On fresh sign-in, claim any anonymous session documents on the server.
        if (u.uid !== prevUid) {
          setPrevUid(u.uid);
          try {
            const token = await u.getIdToken();
            await fetch('/api/auth/claim-session', {
              method: 'POST',
              headers: { authorization: `Bearer ${token}` }
            });
          } catch {
            // non-fatal: handoff will retry on next sign-in
          }
        }
        return;
      }
      // No Firebase user — its storage may have been evicted. Before treating
      // her as signed out, ask the server whether the session cookie is still
      // a valid operator session.
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = (await res.json()) as { user?: { uid: string; email: string | null } };
          if (data.user) {
            setUser({
              uid: data.user.uid,
              email: data.user.email,
              displayName: null,
              photoURL: null,
              isSessionOnly: true
            });
            setLoading(false);
            return;
          }
        }
      } catch {
        // network hiccup — fall through to signed-out
      }
      setUser(null);
      setLoading(false);
    });
    return () => unsub();
  }, [prevUid]);

  const signIn = async (): Promise<User> => {
    const u = await signInWithGoogle();
    // Domain restriction: only @heyrhai.com accounts (plus allow-listed
    // exceptions) may use the dashboard. Reject others immediately with a clear
    // message and sign them straight back out, rather than leaving them in a
    // half-signed-in state with no access.
    const token = await u.getIdToken();
    const res = await fetch('/api/auth/session', { method: 'POST', headers: { authorization: `Bearer ${token}` } });
    if (res.status === 403) {
      const msg = (await res.text().catch(() => '')) || 'This account cannot sign in to the Rhai dashboard.';
      await fbSignOut().catch(() => undefined);
      setUser(null);
      throw new Error(msg);
    }
    try {
      localStorage.setItem(MINT_TS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    return u;
  };

  const signOut = async (): Promise<void> => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
    } catch {
      // best-effort — the cookie expires on its own in ≤14 days
    }
    try {
      localStorage.removeItem(MINT_TS_KEY);
    } catch {
      // ignore
    }
    await fbSignOut();
    setUser(null);
  };

  const value: AuthCtx = {
    user,
    loading,
    signIn,
    signOut,
    getToken: getIdToken
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
