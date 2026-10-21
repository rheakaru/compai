import { NextRequest } from 'next/server';
import { requireCosUser } from '@/lib/cos/auth';
import { consentUrl, googleConfigured } from '@/lib/cos/google';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Returns the Google consent URL for this signed-in person. A POST (not a
// redirect) because a browser navigation can't carry the bearer token; the
// page then sets window.location to the URL. The signed `state` carries the
// uid so the callback knows whose tokens these are.
export async function POST(req: NextRequest) {
  const user = await requireCosUser(req);
  if (user instanceof Response) return user;
  if (!googleConfigured()) return new Response('Google connection is not configured on this server yet.', { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { gmail?: boolean };
  const url = consentUrl({
    uid: user.uid,
    wantGmail: body.gmail !== false,
    origin: req.nextUrl.origin,
    ...(user.email ? { loginHint: user.email } : {})
  });
  return Response.json({ url });
}
