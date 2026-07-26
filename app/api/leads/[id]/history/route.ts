import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromRequest } from '@/lib/firebase/auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Change log for a lead — the conversion-cycle record. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return new Response('unauthorized', { status: 401 });
  if (!user.operator) return new Response('forbidden — operator only', { status: 403 });
  const { id } = await ctx.params;

  const snap = await adminDb()
    .collection('workshopLeads')
    .doc(id)
    .collection('history')
    .orderBy('at', 'desc')
    .limit(50)
    .get();
  return Response.json({ history: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}
