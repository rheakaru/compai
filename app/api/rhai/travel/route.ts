import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireFinance } from '@/lib/rhai/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Client-booked travel & accommodation tracker. Clients book Rhea's travel
// for on-site engagements — each trip tracks what they still owe her
// (flights / hotel / cabs), what's confirmed, and the references.

const COL_TRAVEL = 'rhaiTravel';

export type TravelItemKind = 'flight' | 'hotel' | 'cab' | 'train' | 'other';
export type TravelItemStatus = 'needed' | 'requested' | 'booked';

export interface TravelItem {
  kind: TravelItemKind;
  status: TravelItemStatus;
  /** e.g. "BLR → HYD 14 Aug, morning" or hotel name + nights */
  detail?: string;
  /** PNR / booking ref / confirmation email note once booked */
  confirmation?: string;
}

export interface RhaiTrip {
  id: string;
  client: string;
  leadId?: string;
  city?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;
  purpose?: string; // recce / workshop / build session
  items: TravelItem[];
  note?: string;
  done?: boolean; // trip completed / archived
  createdAt: number;
  updatedAt: number;
}

export async function GET(req: NextRequest) {
  const { error } = await requireFinance(req);
  if (error) return error;
  const snap = await adminDb().collection(COL_TRAVEL).orderBy('updatedAt', 'desc').limit(200).get();
  const trips = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RhaiTrip, 'id'>) }));
  return Response.json({ trips });
}

const ITEM_KINDS: TravelItemKind[] = ['flight', 'hotel', 'cab', 'train', 'other'];
const ITEM_STATUSES: TravelItemStatus[] = ['needed', 'requested', 'booked'];

function cleanItems(raw: unknown): TravelItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .map(i => ({
      kind: ITEM_KINDS.includes(i.kind as TravelItemKind) ? (i.kind as TravelItemKind) : 'other',
      status: ITEM_STATUSES.includes(i.status as TravelItemStatus)
        ? (i.status as TravelItemStatus)
        : 'needed',
      ...(typeof i.detail === 'string' && i.detail.trim() ? { detail: i.detail.trim() } : {}),
      ...(typeof i.confirmation === 'string' && i.confirmation.trim()
        ? { confirmation: i.confirmation.trim() }
        : {})
    }))
    .slice(0, 20);
}

export async function POST(req: NextRequest) {
  const { error } = await requireFinance(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as Partial<RhaiTrip>;
  if (!body.client?.trim()) return new Response('client required', { status: 400 });
  const now = Date.now();
  const trip: Omit<RhaiTrip, 'id'> = {
    client: body.client.trim(),
    ...(body.leadId?.trim() ? { leadId: body.leadId.trim() } : {}),
    ...(body.city?.trim() ? { city: body.city.trim() } : {}),
    ...(body.startDate ? { startDate: body.startDate } : {}),
    ...(body.endDate ? { endDate: body.endDate } : {}),
    ...(body.purpose?.trim() ? { purpose: body.purpose.trim() } : {}),
    items: cleanItems(body.items),
    ...(body.note?.trim() ? { note: body.note.trim() } : {}),
    createdAt: now,
    updatedAt: now
  };
  const ref = await adminDb().collection(COL_TRAVEL).add(trip);
  return Response.json({ trip: { id: ref.id, ...trip } });
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireFinance(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as Partial<RhaiTrip> & { id?: string };
  if (!body.id) return new Response('id required', { status: 400 });
  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  for (const k of ['client', 'city', 'startDate', 'endDate', 'purpose', 'note', 'leadId'] as const) {
    if (typeof body[k] === 'string') patch[k] = body[k];
  }
  if (typeof body.done === 'boolean') patch.done = body.done;
  if (body.items !== undefined) patch.items = cleanItems(body.items);
  await adminDb().collection(COL_TRAVEL).doc(body.id).set(patch, { merge: true });
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireFinance(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return new Response('id required', { status: 400 });
  await adminDb().collection(COL_TRAVEL).doc(body.id).delete();
  return Response.json({ ok: true });
}
