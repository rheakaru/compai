import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/rhai/server';
import { deleteTurn, editTurnText, roomErrorResponse } from '@/lib/rooms/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; turnId: string }> };

/** Operator: correct a turn's text. Body { text }. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id, turnId } = await params;
  const body = (await req.json().catch(() => ({}))) as { text?: string };
  if (typeof body.text !== 'string') return new Response('text required', { status: 400 });
  try {
    await editTurnText(id, turnId, body.text);
    return Response.json({ ok: true });
  } catch (e) {
    return roomErrorResponse(e);
  }
}

/** Operator: drop a turn (a false start, a mic test). */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id, turnId } = await params;
  try {
    await deleteTurn(id, turnId);
    return Response.json({ ok: true });
  } catch (e) {
    return roomErrorResponse(e);
  }
}
