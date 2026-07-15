import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { COL_RSVPS, type PartyRsvp, type RsvpStatus } from '@/lib/rhai/rsvp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Launch-party RSVPs. POST is public (both the /party invite and the /join
// request page). Resubmitting with the same contact updates the existing entry
// (never downgrades an already-approved/confirmed status). GET + PATCH are
// operator-only — the guest list and the approve/decline controls.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function classifyContact(raw: string): { type: 'phone' | 'email'; key: string } | null {
  const contact = raw.trim();
  if (EMAIL_RE.test(contact)) return { type: 'email', key: contact.toLowerCase() };
  const digits = contact.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  // Normalize Indian numbers so "98860…", "098860…" and "+91 98860…" collide.
  const key = digits.length === 10 ? `91${digits}` : digits.length === 11 && digits.startsWith('0') ? `91${digits.slice(1)}` : digits;
  return { type: 'phone', key };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    contact?: string;
    guests?: number;
    note?: string;
    list?: string;
  };

  const name = String(body.name ?? '').trim().slice(0, 80);
  const rawContact = String(body.contact ?? '').trim().slice(0, 120);
  if (name.length < 2) return new Response('Please add your name.', { status: 400 });
  const contact = classifyContact(rawContact);
  if (!contact) return new Response('That doesn’t look like a WhatsApp number or email — mind checking it?', { status: 400 });

  const isRequest = body.list === 'request';
  const guests: 1 | 2 = body.guests === 2 ? 2 : 1;
  const note = String(body.note ?? '').trim().slice(0, 300);
  const now = Date.now();

  const db = adminDb();
  const existing = await db.collection(COL_RSVPS).where('contactKey', '==', contact.key).limit(1).get();
  if (!existing.empty) {
    const ref = existing.docs[0].ref;
    // Update their details but never downgrade a status they've already earned.
    await ref.set(
      { name, contact: rawContact, contactType: contact.type, guests, ...(note ? { note } : {}), updatedAt: now },
      { merge: true }
    );
    const cur = existing.docs[0].data() as PartyRsvp;
    return Response.json({ ok: true, updated: true, id: ref.id, status: cur.status ?? 'confirmed' });
  }

  const status: RsvpStatus = isRequest ? 'pending' : 'confirmed';
  const doc: Omit<PartyRsvp, 'id'> = {
    name,
    contact: rawContact,
    contactType: contact.type,
    contactKey: contact.key,
    guests,
    ...(note ? { note } : {}),
    list: isRequest ? 'request' : 'guest',
    status,
    createdAt: now,
    updatedAt: now
  };
  const ref = db.collection(COL_RSVPS).doc();
  await ref.set(doc);
  return Response.json({ ok: true, id: ref.id, status });
}

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const snap = await adminDb().collection(COL_RSVPS).get();
  const rsvps = snap.docs
    .map(d => {
      const v = d.data() as Omit<PartyRsvp, 'id'>;
      // Backfill defaults for rows created before the request flow existed.
      return { id: d.id, ...v, list: v.list ?? 'guest', status: v.status ?? 'confirmed' };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
  return Response.json({ rsvps });
}

const VALID_STATUS: RsvpStatus[] = ['confirmed', 'pending', 'approved', 'declined'];

/** PATCH { id, status } — operator approve/decline a request. */
export async function PATCH(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { id?: string; status?: RsvpStatus };
  if (!body.id || !body.status || !VALID_STATUS.includes(body.status)) {
    return new Response('expected { id, status }', { status: 400 });
  }
  await adminDb().collection(COL_RSVPS).doc(body.id).set({ status: body.status, updatedAt: Date.now() }, { merge: true });
  return Response.json({ ok: true });
}
