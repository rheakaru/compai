// Transcript rooms — in-person meeting transcription. Rhea (operator) opens a
// room, shares a link/QR, people join by name on their own phones, and each
// person's turn is recorded on their own device and transcribed. Only the
// operator sees the full transcript.

export interface RoomParticipant {
  id: string;
  name: string;
  joinedAt: number;
}

/** The turn being recorded right now (at most one per room). */
export interface RoomCurrent {
  turnId: string;
  participantId: string;
  startedAt: number;
  startedBy: 'self' | 'host';
  /** Rolling live text from the speaker's device. */
  live: string;
}

export type TurnStatus = 'recording' | 'transcribing' | 'done';

export interface RoomTurn {
  id: string;
  participantId: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  startedBy: 'self' | 'host';
  status: TurnStatus;
  /** Live preview text pushed while speaking. */
  liveText: string;
  /** Final, accurate transcript (Scribe over the whole recording). */
  text?: string;
}

export interface RoomSummary {
  id: string;
  name: string;
  status: 'open' | 'ended';
  createdAt: number;
  endedAt?: number;
  leadId?: string;
  leadLabel?: string;
  /** Note session on the lead this room was filed to. */
  noteSessionId?: string;
  filedAt?: number;
}

/** What the operator's console sees. */
export interface HostRoomView extends RoomSummary {
  participants: RoomParticipant[];
  current: RoomCurrent | null;
  turnsRev: number;
}

/** What a participant's phone sees — no one else's words. */
export interface GuestRoomView {
  id: string;
  name: string;
  status: 'open' | 'ended';
  participants: { id: string; name: string }[];
  current: { turnId: string; participantId: string; startedAt: number } | null;
}

/** Best text for a turn: the final transcript, else what streamed live. */
export function turnText(t: Pick<RoomTurn, 'text' | 'liveText'>): string {
  return (t.text ?? '').trim() || (t.liveText ?? '').trim();
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata'
  });
}

export function roomDateLabel(ms: number): string {
  return new Date(ms).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
}

/** Markdown transcript — used for export and for filing onto a client. */
export function transcriptMarkdown(room: Pick<RoomSummary, 'name' | 'createdAt' | 'leadLabel'>, participants: RoomParticipant[], turns: RoomTurn[]): string {
  const lines: string[] = [];
  lines.push(`# ${room.name}`);
  lines.push('');
  lines.push(`${roomDateLabel(room.createdAt)} · in-person room transcript${room.leadLabel ? ` · ${room.leadLabel}` : ''}`);
  if (participants.length) lines.push(`In the room: ${participants.map(p => p.name).join(', ')}`);
  lines.push('');
  for (const t of [...turns].sort((a, b) => a.startedAt - b.startedAt)) {
    const text = turnText(t);
    if (!text) continue;
    lines.push(`**${t.name}** (${clock(t.startedAt)}): ${text}`);
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}
