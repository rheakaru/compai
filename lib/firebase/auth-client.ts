'use client';

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onIdTokenChanged,
  type User
} from 'firebase/auth';
import { getClientAuth } from './client';

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(getClientAuth(), provider);
  return result.user;
}

export async function signOut(): Promise<void> {
  await fbSignOut(getClientAuth());
}

export function watchAuth(cb: (user: User | null) => void): () => void {
  return onIdTokenChanged(getClientAuth(), cb);
}

export async function getIdToken(): Promise<string | null> {
  const u = getClientAuth().currentUser;
  if (!u) return null;
  return u.getIdToken();
}
