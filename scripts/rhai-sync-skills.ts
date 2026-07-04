/**
 * rhai:sync-skills — CLI to pull local Claude Code skills into Rhai's registry.
 *
 * Same logic as the "Sync from ~/.claude/skills" button on the Skills tab
 * (both use lib/rhai/skill-scan.ts). Use the button when running locally;
 * use this CLI when you'd rather not open a browser, or for automation.
 *
 * Run:      npm run rhai:sync-skills
 * Dry-run:  npm run rhai:sync-skills -- --dry
 */
import { config } from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { mergeSkills, scanAllSkills } from '../lib/rhai/skill-scan';
import type { RhaiSkill } from '../lib/rhai/types';

config({ path: '.env.local' });

const DRY = process.argv.includes('--dry');

async function main() {
  const { skills: discovered, sources } = scanAllSkills();
  for (const s of sources) console.log(`  ✓ ${s}`);

  if (discovered.length === 0) {
    console.log('No skills found. Check that ~/.claude/skills/*/SKILL.md exists.');
    return;
  }

  if (DRY) {
    console.log('\n--dry — would upsert:');
    for (const s of discovered) {
      console.log(`  · ${s.id} → model=${s.model}${s.stage ? ` stage=${s.stage}` : ''}`);
      console.log(`    ${s.description.slice(0, 120)}…`);
    }
    return;
  }

  const creds = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!creds) {
    console.error('FIREBASE_ADMIN_CREDENTIALS not set — cannot write to Firestore.');
    console.error('Add it to .env.local, or run with --dry to preview.');
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
  const ref = getFirestore().doc('rhaiConfig/skills');
  const snap = await ref.get();
  const stored = (snap.exists ? ((snap.data()?.skills ?? []) as RhaiSkill[]) : []).filter(
    s => s && typeof s.id === 'string'
  );
  const { merged, added, refreshed } = mergeSkills(stored, discovered);
  await ref.set({ skills: merged, updatedAt: Date.now() });

  console.log(`\n✓ Synced ${discovered.length} scanned skill(s) → ${added} added, ${refreshed} refreshed.`);
  console.log(`  Registry now has ${merged.length} total.`);
  console.log('  Open the Skills tab on /leads to review model routing.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
