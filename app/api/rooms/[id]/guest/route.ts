import { NextRequest } from 'next/server';
import {
  authGuest,
  getGuestRoom,
  pushLive,
  renameGuest,
  roomErrorResponse,
  startTurn,
  stopTurn
} from '@/lib/rooms/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public, token-authed participant actions. Every call carries
 * { participantId, token } from /join.
 *   state            → the guest view (poll)
 *   start            → begin my turn
 *   stop  {turnId}   → end my turn
 *   live  {turnId, text} → push my rolling live text
 *   rename {name}
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    participantId?: string;
    token?: string;
    action?: string;
    turnId?: string;
    text?: string;
    name?: string;
  };
  const pid = body.participantId ?? '';
  const token = body.token ?? '';
  try {
    switch (body.action) {
      case 'state':
        return Response.json({ room: await getGuestRoom(id, pid, token) });
      case 'start':
        await authGuest(id, pid, token);
        return Response.json({ turnId: await startTurn(id, pid, 'self') });
      case 'stop':
        await authGuest(id, pid, token);
        if (!body.turnId) return new Response('turnId required', { status: 400 });
        await stopTurn(id, body.turnId, pid);
        return Response.json({ ok: true });
      case 'live':
        await authGuest(id, pid, token);
        if (!body.turnId) return new Response('turnId required', { status: 400 });
        await pushLive(id, pid, body.turnId, String(body.text ?? ''));
        return Response.json({ ok: true });
      case 'rename':
        await authGuest(id, pid, token);
        await renameGuest(id, pid, body.name ?? '');
        return Response.json({ room: await getGuestRoom(id, pid, token) });
      default:
        return new Response('bad request', { status: 400 });
    }
  } catch (e) {
    return roomErrorResponse(e);
  }
}
