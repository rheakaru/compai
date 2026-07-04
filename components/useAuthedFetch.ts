'use client';

import { useCallback } from 'react';
import { useAuth } from './AuthProvider';

/** fetch() with the operator's Firebase ID token attached. */
export function useAuthedFetch() {
  const { getToken } = useAuth();
  return useCallback(
    async (path: string, init?: RequestInit) => {
      const token = await getToken();
      return fetch(path, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        }
      });
    },
    [getToken]
  );
}
