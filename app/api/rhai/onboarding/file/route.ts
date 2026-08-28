import { NextRequest } from 'next/server';
import { adminBucket } from '@/lib/firebase/admin';
import { ONBOARDING_TOKEN } from '@/lib/rhai/onboarding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Streams a saved onboarding file (voice takeaway or uploaded document) back,
// token-gated. Path is confined to this token's own prefix so the token can't
// be used to read anything else in the bucket.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get('token') !== ONBOARDING_TOKEN) return new Response('forbidden', { status: 403 });
  const path = p.get('path') || '';
  const prefix = `onboarding/${ONBOARDING_TOKEN}/`;
  if (!path.startsWith(prefix) || path.includes('..')) return new Response('bad path', { status: 400 });
  try {
    const f = adminBucket().file(path);
    const [buf] = await f.download();
    const [meta] = await f.getMetadata();
    return new Response(new Uint8Array(buf), {
      headers: {
        'content-type': meta.contentType || 'application/octet-stream',
        'cache-control': 'private, max-age=3600'
      }
    });
  } catch {
    return new Response('not found', { status: 404 });
  }
}
