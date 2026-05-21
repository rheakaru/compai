import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { loadCompanyForAccess } from '@/lib/model/access';
import { coerceEdgeLabel, type GraphEdge, type GraphNode } from '@/lib/model/graph';
import { consumeEdit, editLockedResponse } from '@/lib/limits/edits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EdgeInput = z.object({
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  label: z.string().max(60),
  notes: z.string().max(400).optional().nullable()
});

const BulkAddBody = z.object({
  edges: z.array(EdgeInput).min(1).max(50)
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ companyId: string }> }) {
  const sessionId = await getOrCreateSessionId();
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) return json({ error: 'auth_required' }, 401);
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

  const edit = await consumeEdit(companyId);
  if (!edit.ok) return editLockedResponse(edit.state);

  // Validate that referenced nodes exist and aren't deleted.
  const db = adminDb();
  const nodeIds = new Set<string>();
  for (const e of parsed.data.edges) {
    nodeIds.add(e.fromNodeId);
    nodeIds.add(e.toNodeId);
  }
  const nodesSnap = await db.collection('companies').doc(companyId).collection('graphNodes').get();
  const liveNodeIds = new Set(
    nodesSnap.docs
      .map(d => d.data() as GraphNode)
      .filter(n => !n.deletedAt)
      .map(n => n.id)
  );
  for (const id of nodeIds) {
    if (!liveNodeIds.has(id)) {
      return json({ error: 'invalid_node', message: `Node ${id} does not exist on this company.` }, 400);
    }
  }

  const collection = db.collection('companies').doc(companyId).collection('graphEdges');
  const created: GraphEdge[] = [];
  const batch = db.batch();
  const now = Date.now();
  for (const inp of parsed.data.edges) {
    if (inp.fromNodeId === inp.toNodeId) continue; // ignore self-loops
    const edge: GraphEdge = {
      id: randomUUID(),
      companyId,
      fromNodeId: inp.fromNodeId,
      toNodeId: inp.toNodeId,
      label: coerceEdgeLabel(inp.label),
      notes: inp.notes?.trim() || undefined,
      source: 'user',
      provenance: 'user_provided',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    batch.set(collection.doc(edge.id), edge);
    created.push(edge);
  }
  if (created.length === 0) return json({ error: 'no valid edges' }, 400);
  await batch.commit();
  return json({ ok: true, edges: created, editState: edit.state }, 201);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
