import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sharedDoc } from '@/lib/shared-docs/registry';
import { COL_VIEWS, requestMeta, viewerFromRequest, type DocView } from '@/lib/shared-docs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One row per open, created by the client tracker when the document mounts.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!sharedDoc(slug)) return new Response('not found', { status: 404 });
  const viewer = await viewerFromRequest(req);
  if (!viewer) return new Response('no viewer', { status: 401 });
  const { totalSections, referrer } = (await req.json().catch(() => ({}))) as { totalSections?: number; referrer?: string };
  const now = Date.now();
  const view: DocView = {
    slug,
    viewerId: viewer.id,
    email: viewer.email,
    startedAt: now,
    lastSeenAt: now,
    maxDepth: 0,
    maxSectionIndex: 0,
    maxSection: '',
    totalSections: Math.max(0, Math.min(200, Number(totalSections) || 0)),
    activeSeconds: 0,
    referrer: String(referrer ?? '').slice(0, 300),
    ...requestMeta(req)
  };
  const ref = await adminDb().collection(COL_VIEWS).add(view);
  return Response.json({ viewId: ref.id });
}
