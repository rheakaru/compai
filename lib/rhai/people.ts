import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { COL_PEOPLE } from './server';
import type { PersonLogEntry, RhaiPerson } from './types';

/** Case-insensitive name match — exact first, then first-name/contains. */
export async function findPersonByName(name: string): Promise<RhaiPerson | null> {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  const snap = await adminDb().collection(COL_PEOPLE).get();
  const people = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RhaiPerson, 'id'>) }));

  const exact = people.find(p => p.name.toLowerCase() === needle);
  if (exact) return exact;
  const contains = people.filter(
    p => p.name.toLowerCase().includes(needle) || needle.includes(p.name.toLowerCase())
  );
  return contains.length === 1 ? contains[0] : null;
}

export async function upsertPersonIntel(params: {
  name: string;
  note: string;
  source: PersonLogEntry['source'];
  fields?: Partial<Pick<RhaiPerson, 'headline' | 'company' | 'city' | 'links' | 'tier' | 'leadId'>>;
}): Promise<{ person: RhaiPerson; created: boolean }> {
  const { name, note, source, fields = {} } = params;
  const db = adminDb();
  const now = Date.now();
  const existing = await findPersonByName(name);
  const entry: PersonLogEntry = { at: now, text: note, source };

  if (existing) {
    const ref = db.collection(COL_PEOPLE).doc(existing.id);
    const update: Record<string, unknown> = {
      ...fields,
      notesLog: [...(existing.notesLog ?? []), entry],
      updatedAt: now
    };
    await ref.set(update, { merge: true });
    return { person: { ...existing, ...fields, notesLog: [...(existing.notesLog ?? []), entry] }, created: false };
  }

  const doc: Omit<RhaiPerson, 'id'> = {
    name: name.trim(),
    tier: fields.tier ?? 'community',
    ...fields,
    notesLog: [entry],
    status: 'stub',
    createdAt: now,
    updatedAt: now
  };
  const ref = await db.collection(COL_PEOPLE).add(doc);
  return { person: { id: ref.id, ...doc }, created: true };
}
