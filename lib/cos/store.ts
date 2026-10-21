import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { newAgent, toPhoneDigits, type CosAgent } from './types';

// Firestore access for the Chief of Staff builder. Collections:
//   cosAgents/{uid}        the person's agent (everything the browser may see)
//   cosSecrets/{uid}       Google refresh token — server-only, never returned
//   cosByPhone/{digits}    phone -> uid, so the WhatsApp webhook can route
//   cosSessions/{uid}      rolling conversation memory (web + WhatsApp share it)
//   cosReminders/{id}      due reminders the cron sends
// All of them are closed in firestore.rules; the browser only ever talks to
// /api/cos/* with a bearer token.

export const COL_AGENTS = 'cosAgents';
export const COL_SECRETS = 'cosSecrets';
export const COL_BY_PHONE = 'cosByPhone';
export const COL_SESSIONS = 'cosSessions';
export const COL_REMINDERS = 'cosReminders';

export async function getAgent(uid: string): Promise<CosAgent | null> {
  const snap = await adminDb().collection(COL_AGENTS).doc(uid).get();
  if (!snap.exists) return null;
  return normalize(uid, snap.data() ?? {});
}

export async function getOrCreateAgent(uid: string, email: string, name: string): Promise<CosAgent> {
  const existing = await getAgent(uid);
  if (existing) return existing;
  const fresh = newAgent(uid, email, name);
  await adminDb().collection(COL_AGENTS).doc(uid).set(fresh);
  return fresh;
}

/** Merge a partial update. Keeps the phone index in sync when the number changes. */
export async function saveAgent(uid: string, patch: Partial<CosAgent>): Promise<CosAgent> {
  const db = adminDb();
  const ref = db.collection(COL_AGENTS).doc(uid);
  const before = await getAgent(uid);
  const now = Date.now();
  const next: Record<string, unknown> = { ...patch, updatedAt: now };
  if (patch.profile) {
    const digits = toPhoneDigits(patch.profile.phone ?? '');
    next.profile = { ...patch.profile, phoneDigits: digits };
    const prev = before?.profile.phoneDigits;
    if (prev && prev !== digits) await db.collection(COL_BY_PHONE).doc(prev).delete().catch(() => undefined);
    if (digits.length >= 10) {
      await db.collection(COL_BY_PHONE).doc(digits).set({ uid, last10: digits.slice(-10), updatedAt: now });
    }
  }
  await ref.set(next, { merge: true });
  const after = await getAgent(uid);
  return after!;
}

/** Resolve a WhatsApp sender ("919886750009") to an agent, if anyone registered that number. */
export async function findAgentByPhone(from: string): Promise<CosAgent | null> {
  const db = adminDb();
  const digits = from.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const direct = await db.collection(COL_BY_PHONE).doc(digits).get();
  let uid = direct.data()?.uid as string | undefined;
  if (!uid) {
    // Tolerate a missing/extra country code: match on the last ten digits.
    const q = await db.collection(COL_BY_PHONE).where('last10', '==', digits.slice(-10)).limit(1).get();
    uid = q.docs[0]?.data()?.uid as string | undefined;
  }
  if (!uid) return null;
  return getAgent(uid);
}

export interface CosSecrets {
  googleRefreshToken?: string;
}

export async function getSecrets(uid: string): Promise<CosSecrets> {
  const snap = await adminDb().collection(COL_SECRETS).doc(uid).get();
  return (snap.data() ?? {}) as CosSecrets;
}

export async function setSecrets(uid: string, patch: CosSecrets): Promise<void> {
  await adminDb().collection(COL_SECRETS).doc(uid).set(patch, { merge: true });
}

export async function clearGoogle(uid: string): Promise<void> {
  const db = adminDb();
  await db.collection(COL_SECRETS).doc(uid).set({ googleRefreshToken: null }, { merge: true });
  await db.collection(COL_AGENTS).doc(uid).set({ google: null, updatedAt: Date.now() }, { merge: true });
}

function normalize(uid: string, d: Record<string, unknown>): CosAgent {
  const base = newAgent(uid, String(d.email ?? ''));
  const profile = { ...base.profile, ...((d.profile as object) ?? {}) };
  const specIn = (d.spec as Record<string, unknown>) ?? {};
  const spec = {
    ...base.spec,
    ...specIn,
    toolFlags: { ...base.spec.toolFlags, ...((specIn.toolFlags as object) ?? {}) }
  };
  return {
    ...base,
    ...d,
    uid,
    profile,
    spec,
    interview: Array.isArray(d.interview) ? (d.interview as CosAgent['interview']) : [],
    memory: Array.isArray(d.memory) ? (d.memory as string[]) : [],
    google: d.google ? (d.google as CosAgent['google']) : undefined
  } as CosAgent;
}
