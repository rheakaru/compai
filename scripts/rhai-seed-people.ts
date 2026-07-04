/**
 * rhai:seed-people — parse the community directory markdown into rhaiPeople.
 *
 * Reads rhai-private/community-directory.md, extracts every `- **Name**` line
 * with its tier (from section headers) and description, and upserts into the
 * rhaiPeople collection. Idempotent: matches by exact name; existing people
 * keep their fields, only missing ones fill in.
 *
 * Run: npm run rhai:seed-people
 */
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { PersonTier } from '../lib/rhai/types';

config({ path: '.env.local' });

const creds = process.env.FIREBASE_ADMIN_CREDENTIALS;
if (!creds) {
  console.error('FIREBASE_ADMIN_CREDENTIALS not set');
  process.exit(1);
}
const sa = JSON.parse(creds);
if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key })
  });
}
const db = getFirestore();

const md = readFileSync('rhai-private/community-directory.md', 'utf8');

const TIER_BY_HEADER: Array<[RegExp, PersonTier]> = [
  [/warm leads/i, 'lead'],
  [/partners, hosts, amplifiers/i, 'partner'],
  [/technical peers/i, 'collaborator'],
  [/personal-orbit/i, 'community']
];

interface Seed {
  name: string;
  tier: PersonTier;
  desc: string;
}

const seeds: Seed[] = [];
let tier: PersonTier | null = null;
for (const line of md.split('\n')) {
  const header = /^##\s+(.*)/.exec(line);
  if (header) {
    const match = TIER_BY_HEADER.find(([re]) => re.test(header[1]));
    tier = match ? match[1] : null; // sections like "Network structures" don't seed people
    continue;
  }
  if (!tier) continue;
  const m = /^-\s+\*\*(.+?)\*\*\s*(?:🔥|🤝|🛠)*\s*(?:\((.*?)\))?\s*—\s*(.*)/.exec(line);
  if (!m) continue;
  // Strip markers/emoji and parenthetical qualifiers from the name.
  const name = m[1].replace(/[🔥🤝🛠]/gu, '').replace(/["“”]/g, '').trim();
  if (!name || name.length > 60) continue;
  const desc = (m[3] ?? '').trim();
  seeds.push({ name, tier, desc });
}

async function main() {
  const existingSnap = await db.collection('rhaiPeople').get();
  const existingNames = new Set(
    existingSnap.docs.map(d => String((d.data() as { name?: string }).name ?? '').toLowerCase())
  );

  let added = 0;
  let skipped = 0;
  const now = Date.now();
  for (const s of seeds) {
    if (existingNames.has(s.name.toLowerCase())) {
      skipped++;
      continue;
    }
    await db.collection('rhaiPeople').add({
      name: s.name,
      tier: s.tier,
      notes: s.desc,
      notesLog: [{ at: now, text: s.desc, source: 'seed' }],
      status: 'stub',
      createdAt: now,
      updatedAt: now
    });
    added++;
  }
  console.log(`✓ Parsed ${seeds.length} people from the directory → ${added} added, ${skipped} already present.`);
  console.log('  Open the People tab — use "Rhai, research" per person to build profiles.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
