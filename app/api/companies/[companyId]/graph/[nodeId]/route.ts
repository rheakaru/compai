import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { loadCompanyForAccess } from '@/lib/model/access';
import { coerceRole, isGraphNodeType, type GraphNode } from '@/lib/model/graph';
import { consumeEdit, editLockedResponse } from '@/lib/limits/edits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchBody = z.object({
  type: z.enum(['person', 'org', 'location', 'event', 'object']).optional(),
  role: z.string().max(60).optional(),
  name: z.string().min(1).max(200).optional(),
  notes: z.string().max(400).optional().nullable()
});

async function authedOwnerOr401(
  req: NextRequest,
  companyId: string
): Promise<{ uid: string; sessionId: string } | Response> {
  const sessionId = await getOrCreateSessionId();
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) {
    return new Response(JSON.stringify({ error: 'auth_required' }), {
      status: 401,
      headers: { 'content-type': 'application/json' }
    });
  }
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
  return { uid: user.uid, sessionId };
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ companyId: string; nodeId: string }> }
) {
  const { companyId, nodeId } = await ctx.params;
  const guard = await authedOwnerOr401(req, companyId);
  if (guard instanceof Response) return guard;

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'bad request' }, 400);

  const ref = adminDb()
    .collection('companies')
    .doc(companyId)
    .collection('graphNodes')
    .doc(nodeId);
  const snap = await ref.get();
  if (!snap.exists) return json({ error: 'not found' }, 404);
  const existing = snap.data() as GraphNode;
  if (existing.deletedAt) return json({ error: 'deleted' }, 410);

  const edit = await consumeEdit(companyId);
  if (!edit.ok) return editLockedResponse(edit.state);

  const updates: Partial<GraphNode> = { updatedAt: Date.now() };
  const newType = parsed.data.type && isGraphNodeType(parsed.data.type) ? parsed.data.type : existing.type;
  if (parsed.data.type) updates.type = newType;
  if (parsed.data.role !== undefined) updates.role = coerceRole(newType, parsed.data.role);
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim().slice(0, 200);
  if (parsed.data.notes !== undefined) {
    updates.notes = parsed.data.notes?.trim() ? parsed.data.notes.trim().slice(0, 400) : undefined;
  }
  await ref.update(updates);
  return json({ ok: true, node: { ...existing, ...updates }, editState: edit.state });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ companyId: string; nodeId: string }> }
) {
  const { companyId, nodeId } = await ctx.params;
  const guard = await authedOwnerOr401(req, companyId);
  if (guard instanceof Response) return guard;

  const edit = await consumeEdit(companyId);
  if (!edit.ok) return editLockedResponse(edit.state);

  const ref = adminDb()
    .collection('companies')
    .doc(companyId)
    .collection('graphNodes')
    .doc(nodeId);
  const snap = await ref.get();
  if (!snap.exists) return json({ error: 'not found' }, 404);
  await ref.update({ deletedAt: Date.now(), updatedAt: Date.now() });
  return json({ ok: true, editState: edit.state });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
