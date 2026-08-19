import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/rhai/server';
import { listEventsServer } from '@/lib/rhai/gcal-server';

// Calendar health check — answers "why did adding to my calendar fail?" from
// production, where the credentials actually live. Read-only: it refreshes the
// token, reports the granted scopes, and lists a few events. Operator-gated.
//
// GET /api/rhai/gcal-health

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const env = {
    GOOGLE_OAUTH_CLIENT_ID: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REFRESH_TOKEN: !!process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  };
  const missing = Object.entries(env).filter(([, present]) => !present).map(([k]) => k);
  if (missing.length) {
    return Response.json(
      { ok: false, stage: 'env', missing, hint: 'Set these as App Hosting secrets, then redeploy.' },
      { status: 200 }
    );
  }

  // Granted scopes come back on the refresh response — the fastest way to see
  // whether reads (calendar.readonly) and writes (calendar.events) are allowed.
  let scopes: string | undefined;
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN!,
        grant_type: 'refresh_token'
      })
    });
    const text = await r.text();
    if (!r.ok) {
      const invalidGrant = text.includes('invalid_grant');
      return Response.json({
        ok: false,
        stage: 'token',
        status: r.status,
        detail: text.slice(0, 300),
        hint: invalidGrant
          ? 'Refresh token is dead. Re-mint with `npx tsx scripts/get-google-refresh-token.ts` and update the GOOGLE_OAUTH_REFRESH_TOKEN secret. If it dies every ~7 days, the OAuth consent screen is still in Testing — publish it to Production in Google Cloud Console.'
          : 'Check the client id/secret match the OAuth client the refresh token was minted from.'
      });
    }
    scopes = (JSON.parse(text) as { scope?: string }).scope;
  } catch (e) {
    return Response.json({ ok: false, stage: 'token', detail: e instanceof Error ? e.message : 'failed' });
  }

  const canRead = !!scopes?.includes('calendar.readonly') || !!scopes?.includes('auth/calendar');
  const canWrite = !!scopes?.includes('calendar.events') || !!scopes?.includes('auth/calendar');

  try {
    const now = new Date();
    const events = await listEventsServer(now, new Date(now.getTime() + 7 * 864e5));
    return Response.json({
      ok: canWrite,
      stage: 'ready',
      scopes,
      canRead,
      canWrite,
      eventsNext7Days: events.length,
      sample: events.slice(0, 5).map(e => ({ start: e.start, summary: e.summary })),
      ...(canWrite ? {} : { hint: 'Token lacks calendar.events — writes will fail. Re-mint the refresh token.' })
    });
  } catch (e) {
    return Response.json({
      ok: false,
      stage: 'list',
      scopes,
      canRead,
      canWrite,
      detail: e instanceof Error ? e.message : 'failed'
    });
  }
}
