import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { COL_VIEWS, viewerFromRequest, type DocView } from '@/lib/shared-docs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Reading progress for an open view. Sent periodically and on tab hide /
// page exit (via sendBeacon, so the body arrives as text/plain). Values only
// ever ratchet up.
export async function POST(req: NextRequest) {
  const viewer = await viewerFromRequest(req);
  if (!viewer) return new Response(null, { status: 204 });
  let body: { viewId?: string; depth?: number; sectionIndex?: number; section?: string; activeSeconds?: number } = {};
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new Response(null, { status: 204 });
  }
  if (!body.viewId || !/^[A-Za-z0-9]{10,40}$/.test(body.viewId)) return new Response(null, { status: 204 });

  const ref = adminDb().collection(COL_VIEWS).doc(body.viewId);
  const snap = await ref.get();
  const cur = snap.data() as DocView | undefined;
  if (!cur || cur.viewerId !== viewer.id) return new Response(null, { status: 204 });

  const depth = Math.max(0, Math.min(100, Math.round(Number(body.depth) || 0)));
  const sectionIndex = Math.max(0, Math.min(200, Math.round(Number(body.sectionIndex) || 0)));
  // Cap a single view at 6 hours of reading so a forgotten tab can't inflate it.
  const active = Math.max(0, Math.min(6 * 3600, Math.round(Number(body.activeSeconds) || 0)));
  const patch: Partial<DocView> = { lastSeenAt: Date.now() };
  if (depth > cur.maxDepth) patch.maxDepth = depth;
  if (sectionIndex > cur.maxSectionIndex || !cur.maxSection) {
    patch.maxSectionIndex = Math.max(sectionIndex, cur.maxSectionIndex);
    if (sectionIndex >= cur.maxSectionIndex) patch.maxSection = String(body.section ?? '').slice(0, 120);
  }
  if (active > cur.activeSeconds) patch.activeSeconds = active;
  await ref.update(patch);
  return new Response(null, { status: 204 });
}
