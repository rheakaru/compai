/**
 * transcode-testimonials — convert WebM/Opus voice testimonials to AAC/MP4.
 *
 * iOS Safari has no WebM or Opus decoder, so any testimonial recorded in
 * Chrome (which is what MediaRecorder produces there) is silently unplayable on
 * an iPhone. This walks the collection, re-encodes anything that isn't already
 * MP4, uploads the new object beside the old one, and repoints the document.
 *
 * Idempotent: documents already on audio/mp4 are skipped, so it is safe to
 * re-run. The original object is left in place — nothing is deleted.
 *
 * Uses adminBucket() rather than the default bucket: this project's real
 * objects live in `compai-57d55-media`, and the default name is a phantom that
 * accepts writes and loses them (see the note in lib/firebase/admin.ts).
 *
 * Requires ffmpeg on PATH and FIREBASE_ADMIN_CREDENTIALS in .env.local.
 * Run: npx tsx scripts/transcode-testimonials.ts [--dry]
 */
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

config({ path: '.env.local' });

// lib/firebase/admin.ts can't be imported here (it pulls in `server-only`),
// so the bucket name is mirrored from it. Keep these in sync.
const DURABLE_BUCKET = process.env.MEDIA_BUCKET || 'compai-57d55-media';

const DRY = process.argv.includes('--dry');
const COL = 'rhaiTestimonials';

function init() {
  if (getApps().length) return;
  const creds = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!creds) {
    console.error('FIREBASE_ADMIN_CREDENTIALS not set in .env.local');
    process.exit(1);
  }
  const sa = JSON.parse(creds) as { project_id: string; client_email: string; private_key: string };
  initializeApp({
    credential: cert({
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey: sa.private_key.replace(/\\n/g, '\n')
    })
  });
}

async function main() {
  init();
  const db = getFirestore();
  const bucket = getStorage().bucket(DURABLE_BUCKET);
  const snap = await db.collection(COL).get();
  console.log(`${snap.size} testimonial(s)${DRY ? ' — DRY RUN' : ''}\n`);

  for (const doc of snap.docs) {
    const d = doc.data() as { name?: string; mime?: string; storagePath?: string };
    const label = `${doc.id} (${d.name ?? 'unnamed'})`;
    if (!d.storagePath) {
      console.log(`SKIP  ${label} — no storagePath`);
      continue;
    }
    if ((d.mime ?? '').includes('mp4')) {
      console.log(`OK    ${label} — already mp4`);
      continue;
    }

    const tmp = mkdtempSync(join(tmpdir(), 'tst-'));
    try {
      const srcExt = d.storagePath.split('.').pop() || 'webm';
      const src = join(tmp, `in.${srcExt}`);
      const out = join(tmp, 'out.m4a');
      const [buf] = await bucket.file(d.storagePath).download();
      writeFileSync(src, buf);

      // AAC in an MP4 container — the one audio format every browser decodes.
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-c:a', 'aac', '-b:a', '96k', out]);
      const converted = readFileSync(out);

      const newPath = `testimonials/${doc.id}/${Date.now()}-${randomUUID()}.mp4`;
      console.log(
        `CONV  ${label} — ${d.mime ?? srcExt} ${(buf.length / 1024).toFixed(0)}KB → mp4 ${(converted.length / 1024).toFixed(0)}KB`
      );
      if (DRY) continue;

      await bucket.file(newPath).save(converted, { contentType: 'audio/mp4', resumable: false });
      await doc.ref.set(
        { storagePath: newPath, mime: 'audio/mp4', previousStoragePath: d.storagePath },
        { merge: true }
      );
    } catch (e) {
      console.error(`FAIL  ${label} — ${e instanceof Error ? e.message : e}`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  console.log('\ndone');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
