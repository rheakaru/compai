import { NextRequest } from 'next/server';
import { sharedDoc } from '@/lib/shared-docs/registry';
import { createViewer, isEmail, viewerCookie } from '@/lib/shared-docs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The email gate. No password and no verification — the email is the price of
// entry and the reader's identity in the view log.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!sharedDoc(slug)) return new Response('not found', { status: 404 });
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const clean = (email ?? '').trim();
  if (!isEmail(clean)) return new Response('Please enter a valid email address.', { status: 400 });
  const id = await createViewer(clean);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json', 'set-cookie': viewerCookie(id) }
  });
}
