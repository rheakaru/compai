import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { COL_TESTIMONIALS, type Testimonial } from '@/lib/rhai/testimonials';

// Who unlocked /chief-of-staff-workshop (by leaving a voice testimonial) and
// what they downloaded.

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

// ---------------------------------------------------------------------------
// Access: a real voice testimonial unlocks the guide. The cookie holds the
// testimonial's id; the page re-checks that doc on every load, so deleting a
// testimonial in the dashboard revokes that person's access.
// ---------------------------------------------------------------------------
export const PASS_COOKIE = 'rd_cos_pass';

export function passCookie(testimonialId: string): string {
  return `${PASS_COOKIE}=${testimonialId}; Max-Age=${60 * 60 * 24 * 365}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export async function passFromCookies(cookies: { get(n: string): { value: string } | undefined }) {
  const id = cookies.get(PASS_COOKIE)?.value;
  if (!id || !/^[A-Za-z0-9]{10,40}$/.test(id)) return null;
  const snap = await adminDb().collection(COL_TESTIMONIALS).doc(id).get();
  if (!snap.exists) return null;
  const t = snap.data() as Testimonial;
  if (t.check && !t.check.genuine) return null;
  return { id, name: t.name, email: t.email ?? '' };
}
