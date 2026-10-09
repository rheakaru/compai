import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/rhai/server';
import { connectInstagram, disconnectInstagram, instagramStatus } from '@/lib/site/instagram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Operator-only: connect / check / disconnect the Instagram account whose
// posts are mirrored on the public site. The token is stored server-side and
// never returned.

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  return Response.json(await instagramStatus());
}

export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token?.trim()) return new Response('Paste the access token.', { status: 400 });
  try {
    return Response.json(await connectInstagram(token.trim()));
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'Could not connect.', { status: 422 });
  }
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  await disconnectInstagram();
  return Response.json({ ok: true });
}
