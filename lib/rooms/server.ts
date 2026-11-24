import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
import type { LeadNoteSession, WorkshopLead } from '@/lib/leads/types';
import { refreshLeadUnderstanding } from '@/lib/rhai/leadRefresh';
import {
  roomDateLabel,
  transcriptMarkdown,
  type GuestRoomView,
  type HostRoomView,
  type RoomCurrent,
  type RoomParticipant,
  type RoomTurn
} from './types';

export const COL_ROOMS = 'transcriptRooms';
const MAX_PARTICIPANTS = 60;
const MAX_LIVE_CHARS = 20_000;
const MAX_NOTE_CHARS = 150_000;

/** Stored room doc. Participant tokens are hashed and never leave the server. */
interface RoomDoc {
  name: string;
  status: 'open' | 'ended';
  createdAt: number;
  endedAt?: number;
  createdBy: string;
  leadId?: string;
  leadLabel?: string;
  noteSessionId?: string;
  filedAt?: number;
  participants: Record<string, { name: string; joinedAt: number; tokenHash: string }>;
  current: RoomCurrent | null;
  turnsRev: number;
}

const roomRef = (id: string) => adminDb().collection(COL_ROOMS).doc(id);
const turnsCol = (id: string) => roomRef(id).collection('turns');

// Unguessable ids: the public link is the capability to join.
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
function newId(len: number): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

export function isValidRoomId(id: string): boolean {
  return /^[a-z0-9]{6,32}$/.test(id);
}

export class RoomError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function participantsList(doc: RoomDoc): RoomParticipant[] {
  return Object.entries(doc.participants ?? {})
    .map(([id, p]) => ({ id, name: p.name, joinedAt: p.joinedAt }))
    .sort((a, b) => a.joinedAt - b.joinedAt);
}

function hostView(id: string, doc: RoomDoc): HostRoomView {
  return {
    id,
    name: doc.name,
    status: doc.status,
    createdAt: doc.createdAt,
    endedAt: doc.endedAt,
    leadId: doc.leadId ?? undefined,
    leadLabel: doc.leadLabel ?? undefined,
    noteSessionId: doc.noteSessionId ?? undefined,
    filedAt: doc.filedAt ?? undefined,
    participants: participantsList(doc),
    current: doc.current ?? null,
    turnsRev: doc.turnsRev ?? 0
  };
}

function guestView(id: string, doc: RoomDoc): GuestRoomView {
  return {
    id,
    name: doc.name,
    status: doc.status,
    participants: participantsList(doc).map(p => ({ id: p.id, name: p.name })),
    current: doc.current
      ? { turnId: doc.current.turnId, participantId: doc.current.participantId, startedAt: doc.current.startedAt }
      : null
  };
}

async function loadDoc(id: string): Promise<RoomDoc> {
  if (!isValidRoomId(id)) throw new RoomError(404, 'room not found');
  const snap = await roomRef(id).get();
  if (!snap.exists) throw new RoomError(404, 'room not found');
  return snap.data() as RoomDoc;
}

export async function leadLabelFor(leadId: string): Promise<string | null> {
  const snap = await adminDb().collection('workshopLeads').doc(leadId).get();
  if (!snap.exists) return null;
  const l = snap.data() as WorkshopLead;
  return l.company?.trim() || l.person?.trim() || 'Client';
}

// ---------------------------------------------------------------------------
// Operator
// ---------------------------------------------------------------------------

export async function createRoom(name: string, createdBy: string, leadId?: string | null): Promise<HostRoomView> {
  const id = newId(10);
  const doc: RoomDoc = {
    name: name.trim().slice(0, 120) || 'Untitled room',
    status: 'open',
    createdAt: Date.now(),
    createdBy,
    participants: {},
    current: null,
    turnsRev: 0
  };
  if (leadId) {
    const label = await leadLabelFor(leadId);
    if (!label) throw new RoomError(400, 'client not found');
    doc.leadId = leadId;
    doc.leadLabel = label;
  }
  await roomRef(id).set(doc);
  return hostView(id, doc);
}

export async function listRooms(): Promise<HostRoomView[]> {
  const snap = await adminDb().collection(COL_ROOMS).orderBy('createdAt', 'desc').limit(100).get();
  return snap.docs.map(d => hostView(d.id, d.data() as RoomDoc));
}

export async function getHostRoom(id: string): Promise<HostRoomView> {
  return hostView(id, await loadDoc(id));
}

export async function listTurns(id: string): Promise<RoomTurn[]> {
  const snap = await turnsCol(id).orderBy('startedAt', 'asc').get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RoomTurn, 'id'>) }));
}

export async function setRoomLead(id: string, leadId: string | null): Promise<HostRoomView> {
  await loadDoc(id);
  if (leadId) {
    const label = await leadLabelFor(leadId);
    if (!label) throw new RoomError(400, 'client not found');
    // Changing client: the old filing (if any) stays on the old client.
    await roomRef(id).update({ leadId, leadLabel: label, noteSessionId: null, filedAt: null });
  } else {
    await roomRef(id).update({ leadId: null, leadLabel: null, noteSessionId: null, filedAt: null });
  }
  return getHostRoom(id);
}

export async function renameRoom(id: string, name: string): Promise<void> {
  await loadDoc(id);
  await roomRef(id).update({ name: name.trim().slice(0, 120) || 'Untitled room' });
}

export async function setRoomStatus(id: string, status: 'open' | 'ended'): Promise<void> {
  await adminDb().runTransaction(async tx => {
    const snap = await tx.get(roomRef(id));
    if (!snap.exists) throw new RoomError(404, 'room not found');
    const doc = snap.data() as RoomDoc;
    const patch: Record<string, unknown> = { status };
    if (status === 'ended') {
      patch.endedAt = Date.now();
      if (doc.current) {
        // Close the open turn; the speaker's phone sees it end and uploads.
        tx.update(turnsCol(id).doc(doc.current.turnId), { status: 'transcribing', endedAt: Date.now() });
        patch.current = null;
        patch.turnsRev = (doc.turnsRev ?? 0) + 1;
      }
    }
    tx.update(roomRef(id), patch);
  });
}

export async function deleteTurn(id: string, turnId: string): Promise<void> {
  await adminDb().runTransaction(async tx => {
    const snap = await tx.get(roomRef(id));
    if (!snap.exists) throw new RoomError(404, 'room not found');
    const doc = snap.data() as RoomDoc;
    const patch: Record<string, unknown> = { turnsRev: (doc.turnsRev ?? 0) + 1 };
    if (doc.current?.turnId === turnId) patch.current = null;
    tx.delete(turnsCol(id).doc(turnId));
    tx.update(roomRef(id), patch);
  });
}

export async function editTurnText(id: string, turnId: string, text: string): Promise<void> {
  await adminDb().runTransaction(async tx => {
    const snap = await tx.get(roomRef(id));
    if (!snap.exists) throw new RoomError(404, 'room not found');
    const doc = snap.data() as RoomDoc;
    tx.update(turnsCol(id).doc(turnId), { text: text.slice(0, MAX_LIVE_CHARS) });
    tx.update(roomRef(id), { turnsRev: (doc.turnsRev ?? 0) + 1 });
  });
}

/**
 * File the transcript onto the room's Rhai client as a note session. Re-filing
 * updates the same note rather than adding a duplicate.
 */
export async function fileRoomToLead(id: string): Promise<{ noteSessionId: string; leadId: string }> {
  const doc = await loadDoc(id);
  if (!doc.leadId) throw new RoomError(400, 'room has no client');
  const turns = await listTurns(id);
  const md = transcriptMarkdown(
    { name: doc.name, createdAt: doc.createdAt, leadLabel: doc.leadLabel },
    participantsList(doc),
    turns
  );
  const leadRef = adminDb().collection('workshopLeads').doc(doc.leadId);
  if (!(await leadRef.get()).exists) throw new RoomError(400, 'client not found');

  const session: Omit<LeadNoteSession, 'id'> = {
    text: md.slice(0, MAX_NOTE_CHARS),
    source: 'transcribed',
    label: `Room — ${doc.name} (${roomDateLabel(doc.createdAt)})`,
    at: doc.createdAt
  };
  let noteSessionId = doc.noteSessionId;
  const existing = noteSessionId ? await leadRef.collection('noteSessions').doc(noteSessionId).get() : null;
  if (existing?.exists) {
    await existing.ref.set(session);
  } else {
    noteSessionId = (await leadRef.collection('noteSessions').add(session)).id;
  }
  const now = Date.now();
  await Promise.all([
    leadRef.update({ updatedAt: now }),
    roomRef(id).update({ noteSessionId, filedAt: now })
  ]);

  // Best-effort: let Rhai re-read the client with the new material.
  try {
    await refreshLeadUnderstanding(doc.leadId);
  } catch (e) {
    console.error(`rooms: understanding refresh failed for lead ${doc.leadId}:`, e);
  }
  return { noteSessionId: noteSessionId!, leadId: doc.leadId };
}

// ---------------------------------------------------------------------------
// Turn control — shared by guests (their own turn) and the host (anyone's)
// ---------------------------------------------------------------------------

export async function startTurn(id: string, participantId: string, by: 'self' | 'host'): Promise<string> {
  return adminDb().runTransaction(async tx => {
    const snap = await tx.get(roomRef(id));
    if (!snap.exists) throw new RoomError(404, 'room not found');
    const doc = snap.data() as RoomDoc;
    if (doc.status !== 'open') throw new RoomError(409, 'room has ended');
    const p = doc.participants?.[participantId];
    if (!p) throw new RoomError(404, 'not in this room');
    if (doc.current?.participantId === participantId) return doc.current.turnId; // already talking

    const now = Date.now();
    // One voice at a time: starting a new turn closes whoever was talking.
    if (doc.current) {
      tx.update(turnsCol(id).doc(doc.current.turnId), { status: 'transcribing', endedAt: now });
    }
    const turnRef = turnsCol(id).doc();
    const turn: Omit<RoomTurn, 'id'> = {
      participantId,
      name: p.name,
      startedAt: now,
      startedBy: by,
      status: 'recording',
      liveText: ''
    };
    tx.set(turnRef, turn);
    tx.update(roomRef(id), {
      current: { turnId: turnRef.id, participantId, startedAt: now, startedBy: by, live: '' } satisfies RoomCurrent,
      turnsRev: (doc.turnsRev ?? 0) + 1
    });
    return turnRef.id;
  });
}

export async function stopTurn(id: string, turnId: string, participantId?: string): Promise<void> {
  await adminDb().runTransaction(async tx => {
    const snap = await tx.get(roomRef(id));
    if (!snap.exists) throw new RoomError(404, 'room not found');
    const doc = snap.data() as RoomDoc;
    const tSnap = await tx.get(turnsCol(id).doc(turnId));
    if (!tSnap.exists) return;
    const turn = tSnap.data() as RoomTurn;
    if (participantId && turn.participantId !== participantId) throw new RoomError(403, 'not your turn');
    const patch: Record<string, unknown> = { turnsRev: (doc.turnsRev ?? 0) + 1 };
    if (doc.current?.turnId === turnId) patch.current = null;
    if (turn.status === 'recording') tx.update(tSnap.ref, { status: 'transcribing', endedAt: Date.now() });
    tx.update(roomRef(id), patch);
  });
}

// ---------------------------------------------------------------------------
// Guests
// ---------------------------------------------------------------------------

export async function joinRoom(id: string, name: string): Promise<{ participantId: string; token: string; room: GuestRoomView }> {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!clean) throw new RoomError(400, 'name required');
  const participantId = newId(8);
  const token = randomBytes(24).toString('hex');
  const room = await adminDb().runTransaction(async tx => {
    const snap = await tx.get(roomRef(id));
    if (!snap.exists) throw new RoomError(404, 'room not found');
    const doc = snap.data() as RoomDoc;
    if (doc.status !== 'open') throw new RoomError(409, 'this room has ended');
    if (Object.keys(doc.participants ?? {}).length >= MAX_PARTICIPANTS) throw new RoomError(409, 'room is full');
    const entry = { name: clean, joinedAt: Date.now(), tokenHash: hash(token) };
    tx.update(roomRef(id), { [`participants.${participantId}`]: entry });
    return guestView(id, { ...doc, participants: { ...doc.participants, [participantId]: entry } });
  });
  return { participantId, token, room };
}

/** Throws unless the token belongs to that participant. */
export async function authGuest(id: string, participantId: string, token: string): Promise<RoomDoc> {
  const doc = await loadDoc(id);
  const p = doc.participants?.[participantId];
  if (!p || !token) throw new RoomError(403, 'not in this room');
  const a = Buffer.from(p.tokenHash, 'hex');
  const b = Buffer.from(hash(token), 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new RoomError(403, 'not in this room');
  return doc;
}

export async function getGuestRoom(id: string, participantId: string, token: string): Promise<GuestRoomView> {
  return guestView(id, await authGuest(id, participantId, token));
}

export async function renameGuest(id: string, participantId: string, name: string): Promise<void> {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!clean) throw new RoomError(400, 'name required');
  await roomRef(id).update({ [`participants.${participantId}.name`]: clean });
}

/** Speaker's phone pushes the rolling live text for its open turn. */
export async function pushLive(id: string, participantId: string, turnId: string, text: string): Promise<void> {
  const live = text.slice(0, MAX_LIVE_CHARS);
  await adminDb().runTransaction(async tx => {
    const snap = await tx.get(roomRef(id));
    if (!snap.exists) throw new RoomError(404, 'room not found');
    const doc = snap.data() as RoomDoc;
    const tRef = turnsCol(id).doc(turnId);
    const tSnap = await tx.get(tRef);
    if (!tSnap.exists) return;
    const turn = tSnap.data() as RoomTurn;
    if (turn.participantId !== participantId) throw new RoomError(403, 'not your turn');
    tx.update(tRef, { liveText: live });
    if (doc.current?.turnId === turnId) tx.update(roomRef(id), { 'current.live': live });
  });
}

/** Final transcript for a finished turn (from the whole recording). */
export async function finishTurn(id: string, participantId: string, turnId: string, text: string | null): Promise<void> {
  await adminDb().runTransaction(async tx => {
    const snap = await tx.get(roomRef(id));
    if (!snap.exists) throw new RoomError(404, 'room not found');
    const doc = snap.data() as RoomDoc;
    const tRef = turnsCol(id).doc(turnId);
    const tSnap = await tx.get(tRef);
    if (!tSnap.exists) return;
    const turn = tSnap.data() as RoomTurn;
    if (turn.participantId !== participantId) throw new RoomError(403, 'not your turn');
    const patch: Record<string, unknown> = { status: 'done', endedAt: turn.endedAt ?? Date.now() };
    // Keep the live text if the final pass came back empty or failed.
    if (text && text.trim()) patch.text = text.trim().slice(0, MAX_LIVE_CHARS);
    tx.update(tRef, patch);
    const roomPatch: Record<string, unknown> = { turnsRev: (doc.turnsRev ?? 0) + 1 };
    if (doc.current?.turnId === turnId) roomPatch.current = null;
    tx.update(roomRef(id), roomPatch);
  });
}

export function roomErrorResponse(e: unknown): Response {
  if (e instanceof RoomError) return new Response(e.message, { status: e.status });
  console.error('[rooms]', e);
  return new Response('something went wrong', { status: 500 });
}
