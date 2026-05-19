'use client';

import { useAuth } from './AuthProvider';

export function AuthBar() {
  const { user, signIn, signOut, loading } = useAuth();

  return (
    <div className="flex items-center gap-3 text-xs">
      {loading ? (
        <span className="text-ink-300">…</span>
      ) : user ? (
        <>
          <span className="text-ink-500">{user.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="text-ink-400 hover:text-ink-700"
          >
            sign out
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => signIn().catch(() => undefined)}
          className="rounded border border-ink-300 px-2 py-1 font-medium text-ink-700 hover:bg-white"
        >
          Sign in to save edits
        </button>
      )}
    </div>
  );
}
