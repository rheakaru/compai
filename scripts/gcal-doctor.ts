/**
 * gcal-doctor — diagnose the server-side Google Calendar credentials.
 * Read-only: refreshes the token, prints granted scopes, lists a few events.
 * Run: npx tsx scripts/gcal-doctor.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  console.log('env present:', { clientId: !!id, clientSecret: !!secret, refreshToken: !!refresh });
  if (!id || !secret || !refresh) {
    console.error('\n>> Missing credentials. Refresh token absent locally is expected if only set in Secret Manager.');
    return;
  }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: 'refresh_token' })
  });
  const txt = await r.text();
  console.log('TOKEN status:', r.status);
  if (!r.ok) { console.log(txt.slice(0, 400)); return; }
  const tok = JSON.parse(txt) as { access_token: string; scope?: string };
  console.log('GRANTED SCOPES:', tok.scope);
  const needed = ['calendar.events', 'calendar.readonly'];
  for (const n of needed) console.log(`  ${tok.scope?.includes(n) ? 'OK  ' : 'MISS'} ${n}`);

  const qs = new URLSearchParams({
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + 7 * 864e5).toISOString(),
    singleEvents: 'true', orderBy: 'startTime', maxResults: '5'
  });
  const lr = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${qs}`, {
    headers: { authorization: `Bearer ${tok.access_token}` }
  });
  console.log('LIST status:', lr.status);
  const lt = await lr.text();
  if (!lr.ok) { console.log(lt.slice(0, 400)); return; }
  const items = (JSON.parse(lt).items ?? []) as Array<{ summary?: string; start?: { dateTime?: string; date?: string } }>;
  console.log(`next ${items.length} events:`);
  for (const e of items) console.log('  -', e.start?.dateTime ?? e.start?.date, e.summary);
}
main().catch(e => console.error('FAILED:', e));
