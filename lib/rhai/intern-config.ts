import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { INTERN, type InternConfig } from './onboarding';

// The intern's details for the offer/joining letters, editable from the admin
// page and persisted here (rhaiConfig/internConfig). Falls back to the INTERN
// defaults in onboarding.ts for anything not yet set.

export const INTERN_CONFIG_DOC = 'rhaiConfig/internConfig';

export type StoredInternConfig = Partial<InternConfig>;

export async function loadInternConfig(): Promise<InternConfig> {
  const snap = await adminDb().doc(INTERN_CONFIG_DOC).get();
  const stored = (snap.data() as StoredInternConfig | undefined) ?? {};
  return {
    name: (stored.name ?? INTERN.name) || '',
    title: (stored.title ?? INTERN.title) || INTERN.title,
    stipendLabel: (stored.stipendLabel ?? INTERN.stipendLabel) || '',
    startDateLabel: (stored.startDateLabel ?? INTERN.startDateLabel) || INTERN.startDateLabel,
    termLabel: (stored.termLabel ?? INTERN.termLabel) || INTERN.termLabel,
    pointPerson: (stored.pointPerson ?? INTERN.pointPerson) || INTERN.pointPerson
  };
}

export async function saveInternConfig(patch: StoredInternConfig): Promise<void> {
  const clean: StoredInternConfig = {};
  for (const k of ['name', 'title', 'stipendLabel', 'startDateLabel', 'termLabel', 'pointPerson'] as const) {
    if (typeof patch[k] === 'string') clean[k] = patch[k]!.slice(0, 200);
  }
  await adminDb().doc(INTERN_CONFIG_DOC).set({ ...clean, updatedAt: Date.now() }, { merge: true });
}
