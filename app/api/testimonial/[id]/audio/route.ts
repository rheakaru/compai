import { NextRequest } from 'next/server';
import { adminDb, mediaBucket } from '@/lib/firebase/admin';
import { COL_TESTIMONIALS, type Testimonial } from '@/lib/rhai/testimonials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public: streams a testimonial's audio. Ids are unguessable Firestore ids,
// and testimonials are meant to be heard, so no auth. Cached hard (immutable).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const snap = await adminDb().collection(COL_TESTIMONIALS).doc(id).get();
  if (!snap.exists) return new Response('not found', { status: 404 });
  const t = snap.data() as Testimonial;
  if (!t.storagePath) return new Response('no audio', { status: 404 });
  try {
    const [buf] = await mediaBucket().file(t.storagePath).download();
    return new Response(new Uint8Array(buf), {
      headers: {
        'content-type': t.mime || 'audio/webm',
        'cache-control': 'public, max-age=31536000, immutable'
      }
    });
  } catch {
    return new Response('audio unavailable', { status: 404 });
  }
}
