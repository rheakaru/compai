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
import Anthropic from '@anthropic-ai/sdk';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { DEFAULT_CONTEXT_SECTIONS, SECTION_MODE } from '../lib/rhai/types';
import { RHAI_MODELS } from '../lib/rhai/models';

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

async function main() {
  const update: Record<string, unknown> = { body, updatedAt: Date.now() };

  // Library sections get an always-loaded digest card (the AIMemory pattern):
  // Rhai's every prompt carries this summary; the full doc loads on demand.
  if (SECTION_MODE[sectionId] === 'library') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('⚠ ANTHROPIC_API_KEY not set — uploading without a digest card.');
    } else {
      const title = DEFAULT_CONTEXT_SECTIONS.find(s => s.id === sectionId)?.title ?? sectionId;
      const msg = await new Anthropic({ apiKey }).messages.create({
        model: RHAI_MODELS.digest,
        max_tokens: 400,
        system:
          'You compress reference documents into index cards for an AI agent. Write a single dense paragraph (max ~100 words): what the document contains, its key categories/counts, and 2-3 standout specifics an agent should remember exist. No preamble, no markdown.',
        messages: [{ role: 'user', content: `Document title: ${title}\n\n${body.slice(0, 30_000)}` }]
      });
      update.digest = msg.content
        .filter(b => b.type === 'text')
        .map(b => (b as { text: string }).text)
        .join(' ')
        .trim();
      console.log(`  Digest card: ${String(update.digest).slice(0, 140)}…`);
    }
  }

  await getFirestore().collection('rhaiContext').doc(sectionId).set(update, { merge: true });
  const mode = SECTION_MODE[sectionId] === 'library' ? 'library (digest always-loaded, body on demand)' : 'core (always loaded)';
  console.log(`✓ Uploaded ${filePath} (${(body.length / 1024).toFixed(1)}kb) → rhaiContext/${sectionId} [${mode}]`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
