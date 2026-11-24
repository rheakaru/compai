import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/rhai/server';
import { roomErrorResponse, startTurn, stopTurn } from '@/lib/rooms/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Operator starts or ends someone's turn for them. The person's phone sees the
 * change on its next poll and starts/stops its mic.
 * Body { action: 'start', participantId } | { action: 'stop', turnId }.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    participantId?: string;
    turnId?: string;
  };
  try {
    if (body.action === 'start' && body.participantId) {
      return Response.json({ turnId: await startTurn(id, body.participantId, 'host') });
    }
    if (body.action === 'stop' && body.turnId) {
      await stopTurn(id, body.turnId);
      return Response.json({ ok: true });
    }
    return new Response('bad request', { status: 400 });
  } catch (e) {
    return roomErrorResponse(e);
  }
}
