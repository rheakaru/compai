/**
 * One-time helper: mint the GOOGLE_OAUTH_REFRESH_TOKEN that powers Rhai's
 * server-side Google Calendar access (lib/rhai/gcal-server.ts).
 *
 * Prereqs (Google Cloud console, same project as the app):
 *   1. Enable the Google Calendar API.
 *   2. Create an OAuth client of type "Web application" and add
 *      http://localhost:53682 to its Authorized redirect URIs.
 *   3. Put GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env.local.
 *
 * Run:
 *   npm run gcal-token
 *   (or: npx tsx scripts/get-google-refresh-token.ts)
 *
 * It prints a consent URL — open it, sign in as rhea@rosebazaar.in, approve.
 * Google redirects back to localhost:53682, this script catches the code,
 * exchanges it, and prints the GOOGLE_OAUTH_REFRESH_TOKEN line to paste into
 * .env.local (and the App Hosting secret store for production).
 */
import { createServer } from 'http';
import { config } from 'dotenv';

config({ path: '.env.local' });

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly'
].join(' ');

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env.local first.');
  process.exit(1);
}

const consentUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline', // ask for a refresh token
    prompt: 'consent' // force re-issue even if previously granted
  }).toString();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', REDIRECT_URI);
  const code = url.searchParams.get('code');
  const err = url.searchParams.get('error');
  if (!code && !err) {
    // favicon etc.
    res.writeHead(404).end();
    return;
  }
  if (err) {
    res.writeHead(200, { 'content-type': 'text/plain' }).end(`Consent failed: ${err}. You can close this tab.`);
    console.error(`\nConsent failed: ${err}`);
    server.close();
    process.exit(1);
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });
    const j = (await tokenRes.json()) as { refresh_token?: string; error_description?: string; error?: string };
    if (!tokenRes.ok || !j.refresh_token) {
      const msg = j.error_description ?? j.error ?? `HTTP ${tokenRes.status} (no refresh_token in response)`;
      res.writeHead(200, { 'content-type': 'text/plain' }).end(`Token exchange failed: ${msg}`);
      console.error(`\nToken exchange failed: ${msg}`);
      console.error('If no refresh_token came back, revoke the app at myaccount.google.com/permissions and rerun.');
      server.close();
      process.exit(1);
    }

    res
      .writeHead(200, { 'content-type': 'text/plain' })
      .end('Got the refresh token — check your terminal. You can close this tab.');
    console.log('\nSuccess! Add this to .env.local (and your production secrets):\n');
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${j.refresh_token}\n`);
    console.log('Keep it secret — it grants ongoing calendar access until revoked.');
    server.close();
    process.exit(0);
  } catch (e) {
    console.error('\nToken exchange error:', e);
    res.writeHead(500).end('Token exchange error — see terminal.');
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log('1. Open this URL in your browser and approve calendar access:\n');
  console.log(consentUrl + '\n');
  console.log(`2. Waiting on ${REDIRECT_URI} for Google to redirect back…`);
});
