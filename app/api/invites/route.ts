import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { loadCompanyForAccess } from '@/lib/model/access';
import { loadOntology } from '@/lib/ontology/loader';
import { consumeEdit, editLockedResponse } from '@/lib/limits/edits';
import type { InviteIndexDoc, RoleDoc } from '@/lib/model/role';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  companyId: z.string().min(1),
  roleTitle: z.string().min(1).max(200)
});

export async function POST(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) return json({ error: 'auth_required' }, 401);

  const sessionId = await getOrCreateSessionId();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'bad request' }, 400);
  const { companyId, roleTitle } = parsed.data;

  const access = await loadCompanyForAccess({
    companyId,
    uid: user.uid,
    sessionId
  });
  if (!access) return json({ error: 'company not found' }, 404);
  if (!access.canEdit) return json({ error: 'forbidden' }, 403);

  const edit = await consumeEdit(companyId);
  if (!edit.ok) return editLockedResponse(edit.state);

  const token = randomUUID();
  const roleId = token; // single source of truth — the token IS the role id
  const { hash } = loadOntology();
  const now = Date.now();

  const role: RoleDoc = {
    roleId,
    companyId,
    inviteToken: token,
    roleTitle: roleTitle.trim(),
    inviteeUid: null,
    inviteeSessionId: null,
    inviteeEmail: null,
    status: 'pending',
    createdAt: now,
    startedAt: null,
    completedAt: null,
    ontologyVersionHash: hash
  };

  const index: InviteIndexDoc = {
    token,
    companyId,
    roleId,
    createdAt: now
  };

  const db = adminDb();
  const batch = db.batch();
  batch.set(
    db.collection('companies').doc(companyId).collection('roles').doc(roleId),
    role
  );
  batch.set(db.collection('inviteIndex').doc(token), index);
  await batch.commit();

  return json({ token, roleId, editState: edit.state });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
