import { NextRequest } from 'next/server';
import { transcribeAudioDetailed } from '@/lib/media/scribe';
import { authGuest, finishTurn, roomErrorResponse } from '@/lib/rooms/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024;

function extFor(type: string): string {
  if (type.includes('mp4') || type.includes('m4a')) return 'mp4';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('wav')) return 'wav';
  if (type.includes('mpeg')) return 'mp3';
  return 'webm';
}

/**
 * Public, token-authed audio for a turn (multipart: participantId, token,
 * turnId, kind, audio).
 *   kind=segment → a few seconds of speech, transcribed for the live preview
 *                  on phones (returns { text }, stores nothing).
 *   kind=final   → the whole turn's recording; transcribed and saved as the
 *                  turn's final text (falls back to the live text if empty).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new Response('expected multipart/form-data', { status: 400 });
  }
  const pid = String(form.get('participantId') ?? '');
  const token = String(form.get('token') ?? '');
  const turnId = String(form.get('turnId') ?? '');
  const kind = String(form.get('kind') ?? '');
  const audio = form.get('audio');
  try {
    await authGuest(id, pid, token);
    if (!turnId) return new Response('turnId required', { status: 400 });

    const hasAudio = audio instanceof Blob && audio.size > 0;
    if (hasAudio && audio.size > MAX_BYTES) return new Response('audio too large', { status: 413 });

    if (kind === 'segment') {
      if (!hasAudio) return Response.json({ text: '' });
      // Pass the ORIGINAL Blob through — see lib/media/scribe.ts.
      const r = await transcribeAudioDetailed(audio, `segment.${extFor(audio.type)}`);
      return Response.json({ text: r.text, ok: r.ok });
    }
    if (kind === 'final') {
      const r = hasAudio ? await transcribeAudioDetailed(audio, `turn.${extFor(audio.type)}`) : { text: '', ok: false };
      await finishTurn(id, pid, turnId, r.ok ? r.text : null);
      return Response.json({ text: r.text, ok: r.ok });
    }
    return new Response('bad kind', { status: 400 });
  } catch (e) {
    return roomErrorResponse(e);
  }
}
