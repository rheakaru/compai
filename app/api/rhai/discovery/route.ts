import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import type { DiscoverySession } from '@/lib/rhai/discovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Operator review surface for the public "Talk to Rhai" discovery chats
// (/talk). Every session lands here — completed AND dropped-off — unlike the
// pipeline, which only gets the ones that finished. Read-only; the chat itself
// is written by the public /api/discovery endpoint.
export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  // Lightweight activity summary for the workspace tab badge — createdAt of
  // the most recent sessions only, no transcripts.
  if (req.nextUrl.searchParams.get('summary')) {
    const snap = await adminDb()
      .collection('rhaiDiscoverySessions')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .select('createdAt')
      .get();
    const recentAt = snap.docs.map(d => (d.data().createdAt as number) ?? 0);
    return Response.json({ recentAt, latestAt: recentAt[0] ?? 0 });
  }

  const snap = await adminDb()
    .collection('rhaiDiscoverySessions')
    .orderBy('createdAt', 'desc')
    .limit(300)
    .get();
  const sessions = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<DiscoverySession, 'id'>) }));
  return Response.json({ sessions });
}
