import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';

const COOKIE_NAME = 'compai_session';
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function getOrCreateSessionId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE_NAME)?.value;
  if (existing) return existing;
  const fresh = randomUUID();
  jar.set(COOKIE_NAME, fresh, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR
  });
  return fresh;
}

export async function getSessionId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value ?? null;
}
