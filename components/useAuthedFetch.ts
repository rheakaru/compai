'use client';

import { useCallback } from 'react';
import { useAuth } from './AuthProvider';

/** fetch() with the operator's Firebase ID token attached. */
export function useAuthedFetch() {
  const { getToken } = useAuth();
  return useCallback(
    async (path: string, init?: RequestInit) => {
      const token = await getToken();
      // Never force a JSON content-type on a FormData body — the browser must
      // set multipart/form-data with its own boundary, or the server can't
      // parse the upload. Only default JSON for non-FormData bodies.
      const isForm = typeof FormData !== 'undefined' && init?.body instanceof FormData;
      return fetch(path, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          ...(isForm ? {} : { 'content-type': 'application/json' }),
          ...(token ? { authorization: `Bearer ${token}` } : {})
        }
      });
    },
    [getToken]
  );
}
