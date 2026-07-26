import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { upsertPersonIntel, findPersonByName } from '@/lib/rhai/people';
import { COL_RSVPS, PARTY_EVENT, type PartyRsvp } from '@/lib/rhai/rsvp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Operator-only: fold the launch-party RSVP list into the People directory.
// Everyone who RSVP'd (or requested to join) becomes a person — with one intel
// log entry noting the RSVP. Idempotent: upsertPersonIntel dedupes people by
// name, and we skip the note append when the person's log already carries an
// RSVP-sync entry, so re-running never duplicates anything.

const SYNC_MARK = 'party-rsvp-sync';

function noteFor(r: PartyRsvp): string {
  const what =
    r.list === 'request' && r.status === 'pending'
      ? `Requested to join the launch party (${PARTY_EVENT.date})`
      : `RSVP'd to the launch party (${PARTY_EVENT.date})`;
  const bits = [what, r.guests === 2 ? '+1 guest' : null, r.contact ? `contact: ${r.contact}` : null]
    .filter(Boolean)
    .join(' · ');
  return `[${SYNC_MARK}] ${bits}`;
}

export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const snap = await adminDb().collection(COL_RSVPS).get();
  const rsvps = snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<PartyRsvp, 'id'>) }))
    .map(r => ({ ...r, list: r.list ?? 'guest', status: r.status ?? 'confirmed' }) as PartyRsvp)
    .filter(r => r.status !== 'declined');

  // Belt-and-braces dedupe within the RSVP list itself (contactKey should
  // already be unique, but names can collide across contact keys).
  const seenNames = new Set<string>();
  let created = 0;
  let noted = 0;
  let skipped = 0;

  for (const r of rsvps) {
    const name = r.name.trim();
    if (name.length < 2) continue;
    const nameKey = name.toLowerCase();
    if (seenNames.has(nameKey)) {
      skipped++;
      continue;
    }
    seenNames.add(nameKey);

    // If this person already carries an RSVP-sync log entry, we've synced them
    // before — don't append the note again.
    const existing = await findPersonByName(name);
    if (existing && (existing.notesLog ?? []).some(e => e.text.includes(`[${SYNC_MARK}]`))) {
      skipped++;
      continue;
    }

    const { created: isNew } = await upsertPersonIntel({
      name,
      note: noteFor(r),
      source: 'rhai'
    });
    if (isNew) created++;
    else noted++;
  }

  return Response.json({ ok: true, scanned: rsvps.length, created, noted, skipped });
}
