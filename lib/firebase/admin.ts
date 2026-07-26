import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getDatabase, type Database } from 'firebase-admin/database';
import { getStorage } from 'firebase-admin/storage';

let app: App | undefined;

function init(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }
  const raw = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!raw) {
    throw new Error('FIREBASE_ADMIN_CREDENTIALS env var not set');
  }
  const serviceAccount = JSON.parse(raw);
  app = initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key
    }),
    // RTDB holds the Marketing Engine workspaces (see database.rules.json).
    databaseURL:
      process.env.FIREBASE_DATABASE_URL ||
      'https://compai-57d55-default-rtdb.asia-southeast1.firebasedatabase.app',
    storageBucket:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'compai-57d55.firebasestorage.app'
  });
  return app;
}

let dbConfigured = false;

export function adminDb(): Firestore {
  const db = getFirestore(init());
  if (!dbConfigured) {
    // Allow `undefined` in nested fields. Without this, any axis_position
    // claim with an unset `deviation` / `candidateA` / `candidateB` /
    // `disambiguatingQuestion` would fail to write — and the failure was
    // being silently swallowed by the streaming route's per-claim catch,
    // producing the "Reading…" bug on reload (claims existed in memory just
    // long enough to derive hard_problems, then disappeared).
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Settings can only be applied once per app; safe to no-op on retry.
    }
    dbConfigured = true;
  }
  return db;
}

export function adminAuth(): Auth {
  return getAuth(init());
}

export function adminRtdb(): Database {
  return getDatabase(init());
}

// The default Firebase Storage bucket (`compai-57d55.firebasestorage.app`)
// was NEVER provisioned on this project — verified: it does not exist, nor
// does `.appspot.com`. The only real bucket is `compai-57d55-media`, created
// and owned by the app's service account. So EVERYTHING routes there: any
// prior `bucket()` (default) write silently failed against a phantom bucket,
// which is exactly why the NDA signature save, generated PDFs, lead-document
// uploads, invoices and testimonials appeared to "save" but stored nothing.
const DURABLE_BUCKET = process.env.MEDIA_BUCKET || 'compai-57d55-media';

/** Cloud Storage bucket for uploaded/generated documents. Points at the one
 * bucket that actually exists on this project (see note above). */
export function adminBucket() {
  return getStorage(init()).bucket(DURABLE_BUCKET);
}

/** Same durable bucket, kept as a distinct name for audio/blob call sites. */
export function mediaBucket() {
  return getStorage(init()).bucket(DURABLE_BUCKET);
}
