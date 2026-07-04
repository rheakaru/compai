/**
 * Rhai hands bridge — the link between the dashboard brain and Claude Code.
 *
 * Approving a suggestion on the "Rhai · Today" tab queues it here. A Claude
 * Code session runs this script to see the queue, executes each intent with
 * the right skill + connectors (Gmail drafts, Zoho invoices, deck builds,
 * research), and marks it done. Everything stays draft-only: Claude Code
 * stages the artifact; Rhea sends/issues it.
 *
 * Run:
 *   npm run rhai:intents            # list approved (queued) suggestions
 *   npm run rhai:intents -- done <id>   # mark one executed
 *
 * In a Claude Code session, just say: "run the rhai queue" — Claude runs the
 * list, works each item with the matching skill, and closes them out.
 */
import { config } from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

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

async function main() {
  const [cmd, id] = process.argv.slice(2);

  if (cmd === 'done' && id) {
    await db.collection('rhaiSuggestions').doc(id).set({ status: 'done', updatedAt: Date.now() }, { merge: true });
    console.log(`✓ marked done: ${id}`);
    return;
  }

  const [snap, skillsSnap] = await Promise.all([
    db.collection('rhaiSuggestions').where('status', '==', 'approved').get(),
    db.doc('rhaiConfig/skills').get()
  ]);

  if (snap.empty) {
    console.log('Queue is empty — nothing approved right now.');
    return;
  }

  const skills = (skillsSnap.data()?.skills ?? []) as Array<{ id: string; name: string; model: string; enabled: boolean }>;
  console.log(`${snap.size} approved intent(s) queued:\n`);
  for (const d of snap.docs) {
    const s = d.data();
    console.log(`— [${d.id}] (${s.kind}) ${s.title}`);
    if (s.leadLabel) console.log(`   lead: ${s.leadLabel}${s.leadId ? ` (${s.leadId})` : ''}`);
    console.log(`   ${String(s.detail).replace(/\n/g, '\n   ')}`);
    console.log('');
  }
  if (skills.length) {
    console.log('Skill → model routing (from the dashboard Skills tab):');
    for (const sk of skills.filter(s => s.enabled)) console.log(`   ${sk.name}: ${sk.model}`);
  }
  console.log('\nWhen an intent is executed and its draft staged, close it with:');
  console.log('   npm run rhai:intents -- done <id>');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
