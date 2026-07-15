import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { COL_RSVPS, PARTY_EVENT, IS_GOING, type PartyRsvp } from '@/lib/rhai/rsvp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public: a requester polls their own status by the unguessable RSVP id they
// got on submit (stored in their browser). Only when they're actually going
// (approved/confirmed) do we return the event details — so the venue is never
// exposed to pending or declined requests.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return new Response('expected ?id', { status: 400 });
  const snap = await adminDb().collection(COL_RSVPS).doc(id).get();
  if (!snap.exists) return Response.json({ status: 'unknown' });
  const v = snap.data() as PartyRsvp;
  const status = v.status ?? 'confirmed';
  if (IS_GOING(status)) {
    return Response.json({
      status,
      name: v.name,
      event: { date: PARTY_EVENT.date, time: PARTY_EVENT.time, venue: PARTY_EVENT.venue, mapsUrl: PARTY_EVENT.mapsUrl, calUrl: PARTY_EVENT.calUrl }
    });
  }
  return Response.json({ status });
}
