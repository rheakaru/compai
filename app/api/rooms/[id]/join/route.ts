import { NextRequest } from 'next/server';
import { getHostRoom, joinRoom, roomErrorResponse } from '@/lib/rooms/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public peek for the join screen: just the room's name and whether it's open. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const room = await getHostRoom(id);
    return Response.json({ name: room.name, status: room.status });
  } catch (e) {
    return roomErrorResponse(e);
  }
}

/** Public: enter a room by name. Returns a participant id + secret token. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  try {
    return Response.json(await joinRoom(id, body.name ?? ''));
  } catch (e) {
    return roomErrorResponse(e);
  }
}
