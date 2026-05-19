/**
 * Debug script — dump claim counts and kinds for a given companyId so we can
 * figure out why axis cards render "Reading…" on the live page.
 *
 * Run: npx tsx scripts/debug-company.ts <companyId>
 */
import { config } from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

const companyId = process.argv[2];
if (!companyId) {
  console.error('Usage: npx tsx scripts/debug-company.ts <companyId>');
  process.exit(1);
}

const creds = process.env.FIREBASE_ADMIN_CREDENTIALS;
if (!creds) {
  console.error('FIREBASE_ADMIN_CREDENTIALS not set');
  process.exit(1);
}
const sa = JSON.parse(creds);
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey: sa.private_key
    })
  });
}

const db = getFirestore();

(async () => {
  const companyRef = db.collection('companies').doc(companyId);
  const companySnap = await companyRef.get();
  if (!companySnap.exists) {
    console.log('Company not found.');
    process.exit(1);
  }
  const company = companySnap.data();
  console.log('Company:', { url: company?.url, completedAt: company?.completedAt, ownerUid: company?.ownerUid });

  const claimsSnap = await companyRef.collection('claims').get();
  const claims = claimsSnap.docs.map(d => d.data() as { id?: string; kind: string; content: Record<string, unknown>; supersededBy: string | null });

  const byKind = new Map<string, number>();
  const liveByKind = new Map<string, number>();
  for (const c of claims) {
    byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + 1);
    if (c.supersededBy === null) {
      liveByKind.set(c.kind, (liveByKind.get(c.kind) ?? 0) + 1);
    }
  }
  console.log('\nClaim counts (all / live):');
  const allKinds = new Set([...byKind.keys(), ...liveByKind.keys()]);
  for (const k of allKinds) {
    console.log(`  ${k}: ${byKind.get(k) ?? 0} / ${liveByKind.get(k) ?? 0}`);
  }

  const axisClaims = claims.filter(c => c.kind === 'axis_position' && c.supersededBy === null);
  console.log(`\nLive axis_position claims (${axisClaims.length}):`);
  for (const c of axisClaims) {
    const content = c.content as { axisId?: string; position?: string };
    console.log(`  - axisId="${content.axisId}" position="${content.position}"`);
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
