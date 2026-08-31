import { NextRequest } from 'next/server';
import { adminBucket } from '@/lib/firebase/admin';
import { requireTeam } from '@/lib/rhai/server';
import { getPresentation } from '@/lib/rhai/presentations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Streams a deck for inline viewing (iframe for HTML, browser PDF viewer for
// PDF). Same-origin, so the __rhai_session cookie rides along and requireTeam
// authenticates the iframe request.
export async function GET(req: NextRequest) {
  const { error } = await requireTeam(req);
  if (error) return error;
  const id = req.nextUrl.searchParams.get('id') || '';
  const p = await getPresentation(id);
  if (!p) return new Response('not found', { status: 404 });
  try {
    const [buf] = await adminBucket().file(p.storagePath).download();
    return new Response(new Uint8Array(buf), {
      headers: {
        'content-type': p.format === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8',
        'content-disposition': 'inline',
        'cache-control': 'private, max-age=3600'
      }
    });
  } catch {
    return new Response('unavailable', { status: 404 });
  }
}
