import 'server-only';
import { randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

// Viewer identity + view logging for shared docs. A viewer is an email bound
// to a random id kept in an httpOnly cookie, so a returning reader goes
// straight to the document. Each page load is one "view" row that the client
// keeps updating (scroll depth, furthest section, active reading time).

export const VIEWER_COOKIE = 'rd_viewer';
export const COL_VIEWERS = 'sharedDocViewers';
export const COL_VIEWS = 'sharedDocViews';

export interface Viewer {
  email: string;
  createdAt: number;
}

export interface DocView {
  slug: string;
  viewerId: string;
  email: string;
  startedAt: number;
  lastSeenAt: number;
  /** 0–100, furthest scroll position reached. */
  maxDepth: number;
  /** Furthest section reached (index into the doc's tracked sections). */
  maxSectionIndex: number;
  maxSection: string;
  totalSections: number;
  /** Seconds the tab was visible with recent activity. */
  activeSeconds: number;
  userAgent: string;
  referrer: string;
  ip: string;
  country: string;
}

export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 254;
}

export async function viewerFromRequest(req: NextRequest | { cookies: { get(n: string): { value: string } | undefined } }) {
  const id = req.cookies.get(VIEWER_COOKIE)?.value;
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) return null;
  const snap = await adminDb().collection(COL_VIEWERS).doc(id).get();
  if (!snap.exists) return null;
  return { id, ...(snap.data() as Viewer) };
}

export async function createViewer(email: string): Promise<string> {
  const id = randomUUID();
  await adminDb().collection(COL_VIEWERS).doc(id).set({ email: email.toLowerCase(), createdAt: Date.now() } satisfies Viewer);
  return id;
}

export function viewerCookie(id: string): string {
  return `${VIEWER_COOKIE}=${id}; Max-Age=${60 * 60 * 24 * 365}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function requestMeta(req: NextRequest) {
  const h = req.headers;
  return {
    userAgent: (h.get('user-agent') ?? '').slice(0, 300),
    ip: (h.get('x-forwarded-for') ?? '').split(',')[0].trim().slice(0, 64),
    country: (h.get('x-country-code') || h.get('x-appengine-country') || h.get('cf-ipcountry') || '').slice(0, 8)
  };
}
