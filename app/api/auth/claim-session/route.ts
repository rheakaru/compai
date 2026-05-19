import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { getSessionId } from '@/lib/firebase/session';
import { logFunnelEvent } from '@/lib/funnel/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' }
    });
  }

  const sessionId = await getSessionId();
  if (!sessionId) {
    return new Response(JSON.stringify({ ok: true, claimed: 0 }), {
      headers: { 'content-type': 'application/json' }
    });
  }

  // Find all companies tied to this session that have no owner.
  const db = adminDb();
  const snap = await db
    .collection('companies')
    .where('sessionId', '==', sessionId)
    .where('ownerUid', '==', null)
    .get();

  let claimed = 0;
  for (const doc of snap.docs) {
    await doc.ref.update({ ownerUid: user.uid });
    claimed++;
  }

  await logFunnelEvent({
    sessionId,
    ownerUid: user.uid,
    stage: 'signed_in',
    meta: { claimedCompanies: claimed, email: user.email }
  });

  return new Response(JSON.stringify({ ok: true, claimed }), {
    headers: { 'content-type': 'application/json' }
  });
}
