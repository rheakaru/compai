import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, verifyState } from '@/lib/cos/google';
import { saveAgent, setSecrets } from '@/lib/cos/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Google sends the person back here after consent. We bind the tokens to the
// uid in the signed state, store the refresh token server-side, and bounce
// them to the builder with a flag the page reads.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const back = new URL('/chief-of-staff', req.nextUrl.origin);
  const fail = (why: string) => {
    back.searchParams.set('google', 'error');
    back.searchParams.set('why', why.slice(0, 160));
    return NextResponse.redirect(back);
  };

  if (p.get('error')) return fail(p.get('error') ?? 'denied');
  const state = verifyState(p.get('state') ?? '');
  const code = p.get('code');
  if (!state || !code) return fail('invalid state — try connecting again');

  try {
    const t = await exchangeCode(code, req.nextUrl.origin);
    await setSecrets(state.uid, { googleRefreshToken: t.refreshToken });
    await saveAgent(state.uid, {
      google: { email: t.email, scopes: t.scopes, connectedAt: Date.now() }
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'connection failed');
  }
  back.searchParams.set('google', 'connected');
  return NextResponse.redirect(back);
}
