import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { COL_RSVPS, type PartyRsvp } from '@/lib/rhai/rsvp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Launch-party RSVPs. POST is public (the /party invite form). Resubmitting
// with the same contact updates the existing RSVP instead of duplicating.
// GET is operator-only — the guest list on the dashboard's Party tab.

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
  };

  const name = String(body.name ?? '').trim().slice(0, 80);
  const rawContact = String(body.contact ?? '').trim().slice(0, 120);
  if (name.length < 2) return new Response('Please add your name.', { status: 400 });
  const contact = classifyContact(rawContact);
  if (!contact) return new Response('That doesn’t look like a WhatsApp number or email — mind checking it?', { status: 400 });

  const guests: 1 | 2 = body.guests === 2 ? 2 : 1;
  const note = String(body.note ?? '').trim().slice(0, 240);
  const now = Date.now();

  const db = adminDb();
  const existing = await db.collection(COL_RSVPS).where('contactKey', '==', contact.key).limit(1).get();
  if (!existing.empty) {
    await existing.docs[0].ref.set(
      { name, contact: rawContact, contactType: contact.type, guests, ...(note ? { note } : {}), updatedAt: now },
      { merge: true }
    );
    return Response.json({ ok: true, updated: true });
  }

  const doc: Omit<PartyRsvp, 'id'> = {
    name,
    contact: rawContact,
    contactType: contact.type,
    contactKey: contact.key,
    guests,
    ...(note ? { note } : {}),
    createdAt: now,
    updatedAt: now
  };
  await db.collection(COL_RSVPS).doc().set(doc);
  return Response.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const snap = await adminDb().collection(COL_RSVPS).get();
  const rsvps = snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<PartyRsvp, 'id'>) }))
    .sort((a, b) => b.createdAt - a.createdAt);
  return Response.json({ rsvps });
}
