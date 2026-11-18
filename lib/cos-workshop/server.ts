import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';

// Who signed up on /chief-of-staff-workshop and what they downloaded. The
// email gate reuses the shared-docs viewer cookie (lib/shared-docs/server.ts),
// so someone who already gave their email to a Rhai shared doc walks straight in.

export const COL_WORKSHOP_SIGNUPS = 'cosWorkshopSignups';

function key(email: string) {
  return email.toLowerCase().replace(/[^a-z0-9@._+-]/g, '_').slice(0, 200);
}

export async function recordSignup(email: string, meta: Record<string, string>) {
  const ref = adminDb().collection(COL_WORKSHOP_SIGNUPS).doc(key(email));
  const now = Date.now();
  await adminDb().runTransaction(async t => {
    const snap = await t.get(ref);
    t.set(
      ref,
      { email: email.toLowerCase(), lastAt: now, visits: FieldValue.increment(1), ...(snap.exists ? {} : { firstAt: now }), ...meta },
      { merge: true }
    );
  });
}

export async function recordDownload(email: string, file: string) {
  await adminDb()
    .collection(COL_WORKSHOP_SIGNUPS)
    .doc(key(email))
    .set({ email: email.toLowerCase(), downloads: { [file.replace(/\W/g, '_')]: FieldValue.increment(1) }, lastAt: Date.now() }, { merge: true })
    .catch(() => undefined);
}
