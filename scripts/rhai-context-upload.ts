/**
 * rhai:context — upload a markdown file into a Rhai context-vault section.
 *
 * The Context tab's textareas are great for prose; this is for the big
 * artifacts (community directory, long reference docs) that are easier to
 * maintain as local files. Section ids: about, networks, thinking, demos,
 * templates, community (see DEFAULT_CONTEXT_SECTIONS).
 *
 * Run: npm run rhai:context -- <sectionId> <path/to/file.md>
 * e.g. npm run rhai:context -- community rhai-private/community-directory.md
 */
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { DEFAULT_CONTEXT_SECTIONS } from '../lib/rhai/types';

config({ path: '.env.local' });

const [sectionId, filePath] = process.argv.slice(2);
const validIds = DEFAULT_CONTEXT_SECTIONS.map(s => s.id);

if (!sectionId || !filePath) {
  console.error('Usage: npm run rhai:context -- <sectionId> <file>');
  console.error(`Section ids: ${validIds.join(', ')}`);
  process.exit(1);
}
if (!validIds.includes(sectionId)) {
  console.error(`Unknown section "${sectionId}". Valid: ${validIds.join(', ')}`);
  process.exit(1);
}

const body = readFileSync(filePath, 'utf8');

const creds = process.env.FIREBASE_ADMIN_CREDENTIALS;
if (!creds) {
  console.error('FIREBASE_ADMIN_CREDENTIALS not set in .env.local');
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

getFirestore()
  .collection('rhaiContext')
  .doc(sectionId)
  .set({ body, updatedAt: Date.now() }, { merge: true })
  .then(() => {
    console.log(`✓ Uploaded ${filePath} (${(body.length / 1024).toFixed(1)}kb) → rhaiContext/${sectionId}`);
    console.log('  Rhai now sees this in every pass. Review it on the Context tab.');
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
