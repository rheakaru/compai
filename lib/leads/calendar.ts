'use client';

// Client-side Google Calendar helpers for the leads dashboard. The Calendar
// scope is requested ON DEMAND (a dedicated popup), NOT as part of the app's
// normal Google sign-in — the public diagnosis tool shares that sign-in and
// must not ask every visitor for calendar access.
//
// The OAuth access token from the popup lives ~1 hour and is kept only in
// sessionStorage; there is no server-side token storage. When it expires the
// operator simply reconnects.

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase/client';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events', // create events
  'https://www.googleapis.com/auth/calendar.readonly' // free/busy lookups
];

const STORAGE_KEY = 'gcal_token';

export interface CalToken {
  accessToken: string;
  expiresAt: number;
}

export function loadToken(): CalToken | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as CalToken;
    // Treat as expired a little early to avoid mid-request failures.
    if (t.expiresAt < Date.now() + 30_000) return null;
    return t;
  } catch {
    return null;
  }
}

function saveToken(t: CalToken) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function connectGoogleCalendar(): Promise<CalToken> {
  const provider = new GoogleAuthProvider();
  SCOPES.forEach(s => provider.addScope(s));
  provider.setCustomParameters({ prompt: 'consent' });
  const result = await signInWithPopup(getClientAuth(), provider);
  const accessToken = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  if (!accessToken) throw new Error('Google did not return a calendar access token.');
  const token: CalToken = { accessToken, expiresAt: Date.now() + 55 * 60 * 1000 };
  saveToken(token);
  return token;
}

class CalAuthError extends Error {}

async function gcal(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
  if (res.status === 401 || res.status === 403) {
    clearToken();
    throw new CalAuthError('Calendar access expired — reconnect.');
  }
  if (!res.ok) throw new Error(`Calendar API ${res.status}`);
  return res.json();
}

export interface BusyInterval {
  start: string;
  end: string;
}

export async function getBusy(token: string, timeMin: Date, timeMax: Date): Promise<BusyInterval[]> {
  const d = await gcal(token, 'freeBusy', {
    method: 'POST',
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: 'primary' }]
    })
  });
  return (d?.calendars?.primary?.busy ?? []) as BusyInterval[];
}

export interface NewEvent {
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
}

export async function insertEvent(token: string, e: NewEvent): Promise<{ id: string; htmlLink: string }> {
  const d = await gcal(token, 'calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify({
      summary: e.summary,
      description: e.description,
      location: e.location,
      start: { dateTime: e.start.toISOString() },
      end: { dateTime: e.end.toISOString() }
    })
  });
  return { id: d.id as string, htmlLink: d.htmlLink as string };
}

export function isCalAuthError(err: unknown): boolean {
  return err instanceof CalAuthError;
}
