import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { loadCompanyForAccess } from '@/lib/model/access';
import { coerceRole, isGraphNodeType, type GraphNode, type GraphNodeType } from '@/lib/model/graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NodeInput = z.object({
  type: z.enum(['person', 'org', 'location', 'event', 'object']),
  role: z.string().max(60).default('other'),
  name: z.string().min(1).max(200),
  notes: z.string().max(400).optional().nullable()
});

const BulkAddBody = z.object({
  nodes: z.array(NodeInput).min(1).max(50)
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ companyId: string }> }) {
  const sessionId = await getOrCreateSessionId();
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) {
    return json({ error: 'auth_required' }, 401);
  }
  const { companyId } = await ctx.params;

  const parsed = BulkAddBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'bad request' }, 400);

  const access = await loadCompanyForAccess({
    companyId,
    uid: user.uid,
    sessionId
  });
  if (!access) return json({ error: 'company not found' }, 404);
  if (!access.canEdit) return json({ error: 'forbidden' }, 403);

  const db = adminDb();
  const collection = db.collection('companies').doc(companyId).collection('graphNodes');

  const created: GraphNode[] = [];
  const batch = db.batch();
  const now = Date.now();
  for (const inp of parsed.data.nodes) {
    if (!isGraphNodeType(inp.type)) continue;
    const node: GraphNode = {
      id: randomUUID(),
      companyId,
      type: inp.type,
      role: coerceRole(inp.type as GraphNodeType, inp.role),
      name: inp.name.trim(),
      notes: inp.notes?.trim() || undefined,
      source: 'user',
      provenance: 'user_provided',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    batch.set(collection.doc(node.id), node);
    created.push(node);
  }
  if (created.length === 0) return json({ error: 'no valid nodes' }, 400);
  await batch.commit();
  return json({ ok: true, nodes: created }, 201);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ companyId: string }> }) {
  const sessionId = await getOrCreateSessionId();
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  const { companyId } = await ctx.params;
  const access = await loadCompanyForAccess({
    companyId,
    uid: user?.uid ?? null,
    sessionId
  });
  if (!access) return json({ error: 'company not found' }, 404);
  if (!access.canEdit) return json({ error: 'forbidden' }, 403);

  const snap = await adminDb()
    .collection('companies')
    .doc(companyId)
    .collection('graphNodes')
    .get();
  const nodes = snap.docs
    .map(d => d.data() as GraphNode)
    .filter(n => !n.deletedAt)
    .sort((a, b) => a.createdAt - b.createdAt);
  return json({ nodes });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
