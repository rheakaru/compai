import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { loadCompanyForAccess } from '@/lib/model/access';
import { consumeEdit, editLockedResponse } from '@/lib/limits/edits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  userNotes: z.string().max(8000)
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ companyId: string }> }
) {
  const sessionId = await getOrCreateSessionId();
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) return json({ error: 'auth_required' }, 401);
  const { companyId } = await ctx.params;

  const access = await loadCompanyForAccess({
    companyId,
    uid: user.uid,
    sessionId
  });
  if (!access) return json({ error: 'company not found' }, 404);
  if (!access.canEdit) return json({ error: 'forbidden' }, 403);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'bad request' }, 400);

  const edit = await consumeEdit(companyId);
  if (!edit.ok) return editLockedResponse(edit.state);

  await adminDb()
    .collection('companies')
    .doc(companyId)
    .set({ userNotes: parsed.data.userNotes }, { merge: true });

  return json({ ok: true, editState: edit.state });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
