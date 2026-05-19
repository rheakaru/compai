'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { watchAuth, signInWithGoogle, signOut, getIdToken } from '@/lib/firebase/auth-client';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<User>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [prevUid, setPrevUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = watchAuth(async u => {
      setUser(u);
      setLoading(false);
      // On fresh sign-in, claim any anonymous session documents on the server.
      if (u && u.uid !== prevUid) {
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
    });
    return () => unsub();
  }, [prevUid]);

  const value: AuthCtx = {
    user,
    loading,
    signIn: signInWithGoogle,
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
