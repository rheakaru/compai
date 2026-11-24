import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/rhai/server';
import {
  getHostRoom,
  listTurns,
  renameRoom,
  roomErrorResponse,
  setRoomLead,
  setRoomStatus
} from '@/lib/rooms/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Operator console poll. Returns the room; pass ?turns=1 to include the full
 * turn list (the console only asks when turnsRev moved).
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await params;
  try {
    const room = await getHostRoom(id);
    const withTurns = req.nextUrl.searchParams.get('turns') === '1';
    return Response.json({ room, turns: withTurns ? await listTurns(id) : undefined });
  } catch (e) {
    return roomErrorResponse(e);
  }
}

/** Operator: rename, change client, end or reopen. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    leadId?: string | null;
    status?: 'open' | 'ended';
  };
  try {
    if (typeof body.name === 'string') await renameRoom(id, body.name);
    if (body.leadId !== undefined) await setRoomLead(id, body.leadId || null);
    if (body.status === 'open' || body.status === 'ended') await setRoomStatus(id, body.status);
    return Response.json({ room: await getHostRoom(id) });
  } catch (e) {
    return roomErrorResponse(e);
  }
}
