import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/rhai/server';
import { createRoom, listRooms, roomErrorResponse } from '@/lib/rooms/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Operator: every room, newest first. */
export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  try {
    return Response.json({ rooms: await listRooms() });
  } catch (e) {
    return roomErrorResponse(e);
  }
}

/** Operator: open a room. Body { name, leadId? }. */
export async function POST(req: NextRequest) {
  const { error, user } = await requireOperator(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { name?: string; leadId?: string | null };
  if (!body.name?.trim()) return new Response('name required', { status: 400 });
  try {
    const room = await createRoom(body.name, user.email ?? user.uid, body.leadId || null);
    return Response.json({ room });
  } catch (e) {
    return roomErrorResponse(e);
  }
}
