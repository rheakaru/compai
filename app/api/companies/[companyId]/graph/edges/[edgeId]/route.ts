import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { loadCompanyForAccess } from '@/lib/model/access';
import { consumeEdit, editLockedResponse } from '@/lib/limits/edits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ companyId: string; edgeId: string }> }
) {
  const sessionId = await getOrCreateSessionId();
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) {
    return new Response(JSON.stringify({ error: 'auth_required' }), {
      status: 401,
      headers: { 'content-type': 'application/json' }
    });
  }
  const { companyId, edgeId } = await ctx.params;
  const access = await loadCompanyForAccess({
    companyId,
    uid: user.uid,
    sessionId
  });
  if (!access || !access.canEdit) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' }
    });
  }

  const edit = await consumeEdit(companyId);
  if (!edit.ok) return editLockedResponse(edit.state);

  const ref = adminDb()
    .collection('companies')
    .doc(companyId)
    .collection('graphEdges')
    .doc(edgeId);
  const snap = await ref.get();
  if (!snap.exists) {
    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }
  await ref.update({ deletedAt: Date.now(), updatedAt: Date.now() });
  return new Response(JSON.stringify({ ok: true, editState: edit.state }), {
    headers: { 'content-type': 'application/json' }
  });
}
