import 'server-only';

// Server-side Google Calendar — Phase 3 of the calendar story. The client-side
// helpers in lib/leads/calendar.ts run on a ~1h popup token in localStorage;
// this module holds a long-lived OAuth refresh token in env so Rhai can create
// and read events with no browser in the loop (WhatsApp scheduling, cron
// briefings). Raw fetch only — no googleapis dependency.
//
// Env required:
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//   GOOGLE_OAUTH_REFRESH_TOKEN   (mint once via scripts/get-google-refresh-token.ts)

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GCAL = 'https://www.googleapis.com/calendar/v3';

interface CachedToken {
  accessToken: string;
  expiresAt: number; // ms epoch
}

// Module-scope cache — survives across requests within a warm server instance.
let cached: CachedToken | null = null;

function requireEnv(): { clientId: string; clientSecret: string; refreshToken: string } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Calendar server credentials not configured');
  }
  return { clientId, clientSecret, refreshToken };
}

async function getAccessToken(): Promise<string> {
  // Refresh a little early to avoid mid-request expiry.
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.accessToken;

  const { clientId, clientSecret, refreshToken } = requireEnv();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // invalid_grant is overwhelmingly the cause of "calendar suddenly stopped
    // working": the refresh token was revoked, the password changed, or — most
    // commonly — the OAuth consent screen is still in "Testing", where Google
    // expires refresh tokens after 7 days. Say so, rather than leaking raw JSON
    // into a WhatsApp reply.
    if (detail.includes('invalid_grant')) {
      cached = null;
      throw new Error(
        'Google refresh token is no longer valid (invalid_grant). Re-mint it with ' +
          '`npx tsx scripts/get-google-refresh-token.ts` and update the ' +
          'GOOGLE_OAUTH_REFRESH_TOKEN secret. If this keeps recurring every ~7 days, ' +
          'the OAuth consent screen is still in Testing — publish it to Production.'
      );
    }
    throw new Error(`Google token refresh failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error('Google token refresh returned no access_token');
  cached = {
    accessToken: j.access_token,
    expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000
  };
  return cached.accessToken;
}

async function gcalFetch(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const token = await getAccessToken();
  const res = await fetch(`${GCAL}/${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
  if (!res.ok) {
    let reason = '';
    let raw = '';
    try {
      raw = await res.text();
      const body = JSON.parse(raw) as { error?: { message?: string; errors?: Array<{ reason?: string }> } };
      reason = body?.error?.message ?? '';
      const code = body?.error?.errors?.[0]?.reason;
      if (code) reason = `${reason} [${code}]`;
    } catch {
      reason = raw.slice(0, 200);
    }
    // Without this, a failed write reaches Rhea as a shrug. Log the real cause.
    console.error('[gcal] %s %s failed: %s %s', init?.method ?? 'GET', path, res.status, reason);
    if (res.status === 401 || res.status === 403) {
      cached = null; // force a fresh token on the next call
    }
    throw new Error(`Calendar API ${res.status}: ${reason || 'no detail'}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/** A point in time with an explicit IANA timezone — never trust server locale. */
export interface EventDateTime {
  dateTime: string; // e.g. "2026-07-25T15:00:00"
  timeZone: string; // e.g. "Asia/Kolkata"
}

export interface InsertEventParams {
  summary: string;
  description?: string;
  start: EventDateTime;
  end: EventDateTime;
  attendeeEmails?: string[];
  withMeet?: boolean;
}

export interface InsertedEvent {
  id: string;
  htmlLink: string;
  meetLink?: string;
}

/**
 * Create an event on the primary calendar. Attendees get invite emails
 * (sendUpdates=all); withMeet attaches a Google Meet conference.
 */
export async function insertEventServer(p: InsertEventParams): Promise<InsertedEvent> {
  const qs = new URLSearchParams({ sendUpdates: 'all' });
  if (p.withMeet) qs.set('conferenceDataVersion', '1');
  const body: Record<string, unknown> = {
    summary: p.summary,
    ...(p.description ? { description: p.description } : {}),
    start: { dateTime: p.start.dateTime, timeZone: p.start.timeZone },
    end: { dateTime: p.end.dateTime, timeZone: p.end.timeZone },
    ...(p.attendeeEmails?.length ? { attendees: p.attendeeEmails.map(email => ({ email })) } : {}),
    ...(p.withMeet
      ? {
          conferenceData: {
            createRequest: {
              requestId: `rhai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
          }
        }
      : {})
  };
  const d = await gcalFetch(`calendars/primary/events?${qs.toString()}`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  const conference = d.conferenceData as
    | { entryPoints?: Array<{ entryPointType?: string; uri?: string }> }
    | undefined;
  const meetLink =
    (d.hangoutLink as string | undefined) ??
    conference?.entryPoints?.find(e => e.entryPointType === 'video')?.uri;
  return {
    id: d.id as string,
    htmlLink: d.htmlLink as string,
    ...(meetLink ? { meetLink } : {})
  };
}

export interface ServerCalAttendee {
  email: string;
  displayName?: string;
}

export interface ServerCalEvent {
  id: string;
  summary: string;
  start: string; // ISO datetime, or all-day date (YYYY-MM-DD)
  allDay: boolean;
  attendees: ServerCalAttendee[];
  hangoutLink?: string;
  location?: string;
  htmlLink?: string;
}

/** Upcoming events on the primary calendar between timeMin and timeMax. */
export async function listEventsServer(timeMin: Date, timeMax: Date): Promise<ServerCalEvent[]> {
  const qs = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50'
  });
  const d = await gcalFetch(`calendars/primary/events?${qs.toString()}`);
  const items = (d.items ?? []) as Array<{
    id: string;
    summary?: string;
    htmlLink?: string;
    hangoutLink?: string;
    location?: string;
    start?: { dateTime?: string; date?: string };
    attendees?: Array<{ email?: string; displayName?: string; resource?: boolean }>;
  }>;
  return items.map(e => ({
    id: e.id,
    summary: e.summary || '(no title)',
    start: e.start?.dateTime ?? e.start?.date ?? '',
    allDay: !e.start?.dateTime,
    attendees: (e.attendees ?? [])
      .filter(a => a.email && !a.resource)
      .map(a => ({ email: a.email as string, ...(a.displayName ? { displayName: a.displayName } : {}) })),
    ...(e.hangoutLink ? { hangoutLink: e.hangoutLink } : {}),
    ...(e.location ? { location: e.location } : {}),
    ...(e.htmlLink ? { htmlLink: e.htmlLink } : {})
  }));
}
