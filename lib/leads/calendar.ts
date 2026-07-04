'use client';

// Client-side Google Calendar helpers for the leads dashboard. The Calendar
// scope is requested ON DEMAND (a dedicated popup), NOT as part of the app's
// normal Google sign-in — the public diagnosis tool shares that sign-in and
// must not ask every visitor for calendar access.
//
// The OAuth access token from the popup lives ~1 hour. We keep it in
// localStorage (not sessionStorage) so it survives page reloads and new tabs
// within its lifetime — previously it vanished on every reload, which is why
// the calendar "kept breaking". There is still no server-side token storage,
// so once the hour is up the operator reconnects (a single popup click).
// (Phase 3 moves free/busy + event creation to the server via the Google
// Calendar connector for true always-on persistence.)

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

function store(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadToken(): CalToken | null {
  try {
    const raw = store()?.getItem(STORAGE_KEY);
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
    store()?.setItem(STORAGE_KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
}

export function clearToken() {
  try {
    store()?.removeItem(STORAGE_KEY);
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
  if (res.ok) return res.json();

  // Only a 401 means the token is actually expired/invalid — reconnecting helps.
  if (res.status === 401) {
    clearToken();
    throw new CalAuthError('Calendar access expired — reconnect.');
  }

  // Surface Google's real message (e.g. "Calendar API has not been used in
  // project … before or it is disabled"). A 403 here is usually a disabled
  // API or a missing scope, NOT an expired token.
  let detail = `Calendar API ${res.status}`;
  try {
    const body = await res.json();
    const msg = body?.error?.message ?? body?.error?.errors?.[0]?.message;
    if (msg) detail = msg;
  } catch {
    /* ignore */
  }
  throw new Error(detail);
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

export interface CalEvent {
  id: string;
  summary: string;
  start: string; // ISO datetime or all-day date
  allDay: boolean;
  htmlLink: string;
}

/** Upcoming events on the primary calendar, soonest first — for the glance strip. */
export async function listUpcomingEvents(
  token: string,
  timeMin: Date,
  timeMax: Date,
  maxResults = 10
): Promise<CalEvent[]> {
  const qs = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(maxResults)
  });
  const d = await gcal(token, `calendars/primary/events?${qs.toString()}`);
  const items = (d?.items ?? []) as Array<{
    id: string;
    summary?: string;
    htmlLink: string;
    start?: { dateTime?: string; date?: string };
  }>;
  return items.map(e => ({
    id: e.id,
    summary: e.summary || '(no title)',
    start: e.start?.dateTime ?? e.start?.date ?? '',
    allDay: !e.start?.dateTime,
    htmlLink: e.htmlLink
  }));
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
