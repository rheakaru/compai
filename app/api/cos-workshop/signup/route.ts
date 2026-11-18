import { NextRequest } from 'next/server';
import { createViewer, isEmail, requestMeta, viewerCookie, viewerFromRequest } from '@/lib/shared-docs/server';
import { recordSignup } from '@/lib/cos-workshop/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Email in, cookie out. No password, no verification — same deal as the
// shared-doc gate.
export async function POST(req: NextRequest) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const clean = (email ?? '').trim();
  if (!isEmail(clean)) return new Response('Please enter a valid email address.', { status: 400 });
  const existing = await viewerFromRequest(req);
  const id = existing && existing.email === clean.toLowerCase() ? existing.id : await createViewer(clean);
  await recordSignup(clean, requestMeta(req));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json', 'set-cookie': viewerCookie(id) }
  });
}
