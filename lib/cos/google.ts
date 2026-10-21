import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import { getSecrets } from './store';

// Per-person Google access for the Chief of Staff — OAuth consent, refresh
// tokens, and the thin Calendar + Gmail reads the agent's tools need. Mirrors
// lib/rhai/gcal-server.ts (Rhea's own calendar) but keyed per uid, with the
// refresh token in cosSecrets/{uid}. Raw fetch, no googleapis dependency.
//
// Google Cloud setup (same OAuth client the Rhai calendar uses):
//   - Enable the Gmail API alongside the Calendar API.
//   - Add the redirect URI: https://heyrhai.com/api/cos/google/callback
//     (and http://localhost:3000/api/cos/google/callback for dev).
//   - Add gmail.readonly + the calendar scopes to the consent screen.
//   Note: gmail.readonly is a "restricted" scope. Until Google verifies the
//   app, the consent screen shows an "unverified app" warning and Google caps
//   unverified apps at 100 users for sensitive/restricted scopes.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GCAL = 'https://www.googleapis.com/calendar/v3';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1';

export const SCOPE_CAL_READ = 'https://www.googleapis.com/auth/calendar.readonly';
export const SCOPE_CAL_EVENTS = 'https://www.googleapis.com/auth/calendar.events';
export const SCOPE_GMAIL_READ = 'https://www.googleapis.com/auth/gmail.readonly';

function clientCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google OAuth client not configured');
  return { clientId, clientSecret };
}

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

/** Where Google sends the person back. Production is fixed; dev uses the request origin. */
export function redirectUri(origin: string): string {
  const base = process.env.COS_PUBLIC_ORIGIN || (origin.includes('localhost') ? origin : 'https://heyrhai.com');
  return `${base}/api/cos/google/callback`;
}

// ---- signed state: binds the callback to the uid that started it ----------
function stateKey(): string {
  return process.env.COS_STATE_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || 'dev';
}

export function signState(uid: string, wantGmail: boolean): string {
  const payload = Buffer.from(JSON.stringify({ uid, g: wantGmail ? 1 : 0, t: Date.now() })).toString('base64url');
  const sig = createHmac('sha256', stateKey()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyState(state: string): { uid: string; wantGmail: boolean } | null {
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', stateKey()).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const j = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { uid: string; g: number; t: number };
    if (Date.now() - j.t > 15 * 60_000) return null; // 15-minute window
    return { uid: j.uid, wantGmail: j.g === 1 };
  } catch {
    return null;
  }
}

export function consentUrl(opts: { uid: string; wantGmail: boolean; origin: string; loginHint?: string }): string {
  const { clientId } = clientCreds();
  const scopes = [SCOPE_CAL_READ, SCOPE_CAL_EVENTS, ...(opts.wantGmail ? [SCOPE_GMAIL_READ] : [])];
  const qs = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(opts.origin),
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: signState(opts.uid, opts.wantGmail),
    ...(opts.loginHint ? { login_hint: opts.loginHint } : {})
  });
  return `${AUTH_URL}?${qs.toString()}`;
}

export interface ExchangedTokens {
  refreshToken: string;
  accessToken: string;
  scopes: string[];
  email: string;
}

export async function exchangeCode(code: string, origin: string): Promise<ExchangedTokens> {
  const { clientId, clientSecret } = clientCreds();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(origin),
      grant_type: 'authorization_code'
    })
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { access_token?: string; refresh_token?: string; scope?: string };
  if (!j.access_token) throw new Error('no access_token');
  if (!j.refresh_token) throw new Error('Google did not return a refresh token — remove the app at myaccount.google.com/permissions and try again');
  // Whose account is this? (userinfo needs no extra scope beyond what we got.)
  let email = '';
  try {
    const u = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { authorization: `Bearer ${j.access_token}` }
    });
    if (u.ok) email = String(((await u.json()) as { email?: string }).email ?? '');
  } catch {
    // best-effort
  }
  return {
    refreshToken: j.refresh_token,
    accessToken: j.access_token,
    scopes: (j.scope ?? '').split(' ').filter(Boolean),
    email
  };
}

// ---- access tokens, cached per uid in-process ------------------------------
const cache = new Map<string, { token: string; exp: number }>();

async function accessTokenFor(uid: string): Promise<string> {
  const hit = cache.get(uid);
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;
  const { googleRefreshToken } = await getSecrets(uid);
  if (!googleRefreshToken) throw new Error('Google is not connected');
  const { clientId, clientSecret } = clientCreds();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: googleRefreshToken,
      grant_type: 'refresh_token'
    })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (detail.includes('invalid_grant')) throw new Error('Google access was revoked or expired — reconnect it on your setup page');
    throw new Error(`Google token refresh failed (${res.status})`);
  }
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error('no access token');
  cache.set(uid, { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 });
  return j.access_token;
}

export async function revokeToken(uid: string): Promise<void> {
  const { googleRefreshToken } = await getSecrets(uid);
  cache.delete(uid);
  if (!googleRefreshToken) return;
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(googleRefreshToken)}`, {
    method: 'POST'
  }).catch(() => undefined);
}

async function gfetch(uid: string, url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const token = await accessTokenFor(uid);
  const res = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init?.headers ?? {}) }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 403 && body.includes('insufficient')) throw new Error('That Google permission was not granted — reconnect and tick it');
    throw new Error(`Google API ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

// ---- Calendar ---------------------------------------------------------------
export interface CosCalEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  attendees: string[];
  meet?: string;
}

export async function listEvents(uid: string, from: Date, to: Date): Promise<CosCalEvent[]> {
  const qs = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '40'
  });
  const d = await gfetch(uid, `${GCAL}/calendars/primary/events?${qs}`);
  const items = (d.items ?? []) as Array<{
    id: string;
    summary?: string;
    location?: string;
    hangoutLink?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    attendees?: Array<{ email?: string; displayName?: string; self?: boolean }>;
  }>;
  return items.map(e => ({
    id: e.id,
    summary: e.summary || '(no title)',
    start: e.start?.dateTime ?? e.start?.date ?? '',
    end: e.end?.dateTime ?? e.end?.date ?? '',
    allDay: !e.start?.dateTime,
    ...(e.location ? { location: e.location } : {}),
    attendees: (e.attendees ?? []).filter(a => a.email && !a.self).map(a => a.displayName || (a.email as string)),
    ...(e.hangoutLink ? { meet: e.hangoutLink } : {})
  }));
}

export async function insertEvent(
  uid: string,
  p: { summary: string; description?: string; startIst: string; endIst: string; attendees?: string[] }
): Promise<{ htmlLink: string; meet?: string }> {
  const qs = new URLSearchParams({ sendUpdates: 'all' });
  const withMeet = (p.attendees?.length ?? 0) > 0;
  if (withMeet) qs.set('conferenceDataVersion', '1');
  const body = {
    summary: p.summary,
    ...(p.description ? { description: p.description } : {}),
    start: { dateTime: p.startIst, timeZone: 'Asia/Kolkata' },
    end: { dateTime: p.endIst, timeZone: 'Asia/Kolkata' },
    ...(p.attendees?.length ? { attendees: p.attendees.map(email => ({ email })) } : {}),
    ...(withMeet
      ? { conferenceData: { createRequest: { requestId: `cos-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } } }
      : {})
  };
  const d = await gfetch(uid, `${GCAL}/calendars/primary/events?${qs}`, { method: 'POST', body: JSON.stringify(body) });
  return { htmlLink: String(d.htmlLink ?? ''), ...(d.hangoutLink ? { meet: String(d.hangoutLink) } : {}) };
}

// ---- Gmail (readonly) ------------------------------------------------------
export interface CosMailHead {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

export async function searchMail(uid: string, query: string, max = 8): Promise<CosMailHead[]> {
  const qs = new URLSearchParams({ q: query, maxResults: String(Math.min(Math.max(max, 1), 15)) });
  const list = await gfetch(uid, `${GMAIL}/users/me/messages?${qs}`);
  const ids = ((list.messages ?? []) as Array<{ id: string }>).map(m => m.id);
  const heads = await Promise.all(
    ids.map(async id => {
      const m = await gfetch(
        uid,
        `${GMAIL}/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
      );
      const headers = ((m.payload as { headers?: Array<{ name: string; value: string }> })?.headers ?? []);
      const h = (n: string) => headers.find(x => x.name.toLowerCase() === n)?.value ?? '';
      return {
        id,
        threadId: String(m.threadId ?? ''),
        from: h('from'),
        subject: h('subject'),
        date: h('date'),
        snippet: String(m.snippet ?? '')
      };
    })
  );
  return heads;
}

export async function readMail(uid: string, id: string): Promise<{ head: CosMailHead; body: string }> {
  const m = await gfetch(uid, `${GMAIL}/users/me/messages/${encodeURIComponent(id)}?format=full`);
  const payload = m.payload as MailPart | undefined;
  const headers = payload?.headers ?? [];
  const h = (n: string) => headers.find(x => x.name.toLowerCase() === n)?.value ?? '';
  const text = extractText(payload) || String(m.snippet ?? '');
  return {
    head: { id, threadId: String(m.threadId ?? ''), from: h('from'), subject: h('subject'), date: h('date'), snippet: String(m.snippet ?? '') },
    body: text.slice(0, 6000)
  };
}

interface MailPart {
  mimeType?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string; size?: number };
  parts?: MailPart[];
}

function extractText(p?: MailPart): string {
  if (!p) return '';
  if (p.mimeType === 'text/plain' && p.body?.data) return decode(p.body.data);
  if (p.parts) {
    const plain = p.parts.map(extractText).filter(Boolean);
    if (plain.length) return plain.join('\n');
  }
  if (p.mimeType === 'text/html' && p.body?.data) return stripHtml(decode(p.body.data));
  return '';
}

function decode(b64url: string): string {
  try {
    return Buffer.from(b64url, 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
