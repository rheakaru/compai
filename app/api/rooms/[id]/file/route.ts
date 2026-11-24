import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/rhai/server';
import { fileRoomToLead, getHostRoom, roomErrorResponse } from '@/lib/rooms/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Operator: file (or re-file) the transcript onto the room's Rhai client. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await params;
  try {
    const filed = await fileRoomToLead(id);
    return Response.json({ ...filed, room: await getHostRoom(id) });
  } catch (e) {
    return roomErrorResponse(e);
  }
}
