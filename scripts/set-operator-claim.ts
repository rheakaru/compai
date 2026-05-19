/**
 * Grant a Firebase Auth user the `operator: true` custom claim.
 * The operator sees /admin/funnel and can edit the ontology.
 *
 * Run:
 *   FIREBASE_ADMIN_CREDENTIALS="$(cat path/to/service-account.json)" \
 *     npm run set-operator -- rhea@rosebazaar.in
 *
 * Or with the env already loaded from .env.local:
 *   npm run set-operator -- rhea@rosebazaar.in
 */
import { config } from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

config({ path: '.env.local' });

const email = process.argv[2];
if (!email) {
  console.error('Usage: npm run set-operator -- <email>');
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

(async () => {
  const user = await getAuth().getUserByEmail(email);
  await getAuth().setCustomUserClaims(user.uid, { operator: true });
  console.log(`Granted operator:true to ${email} (uid=${user.uid}).`);
  console.log('They must sign out and back in for the claim to appear in their token.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
