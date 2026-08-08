/* ============================================================
   functions/rhai-cron.js — Rhai scheduled triggers

   Thin Cloud Scheduler shims: all real logic lives in the Next.js
   app's cron routes (App Hosting), authenticated by CRON_SECRET.
     firebase apphosting:secrets:set CRON_SECRET   (same value here)
     firebase functions:secrets:set CRON_SECRET
   ============================================================ */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');

const CRON_SECRET = defineSecret('CRON_SECRET');
const APP_BASE = 'https://heyrhai.com';

async function hitCron(path, secret, body) {
  const res = await fetch(`${APP_BASE}${path}`, {
    method: 'POST',
    headers: { 'x-cron-secret': secret, 'content-type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const text = await res.text().catch(() => '');
  console.log(`${path} -> ${res.status} ${text.slice(0, 2000)}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
}

// Daily 6:30am IST — pull yesterday's Fireflies transcripts into leads,
// flag capture gaps (calls with no transcript) and unmatched calls.
exports.rhaiFirefliesSync = onSchedule(
  {
    schedule: '30 6 * * *',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
    secrets: [CRON_SECRET],
    timeoutSeconds: 540,
    memory: '256MiB'
  },
  () => hitCron('/api/rhai/cron/fireflies-sync', CRON_SECRET.value())
);

// Daily 8:00am IST — session reminders at T-5 (data/discovery), T-3
// (participant reminder + setup), T-1 (day-before checks, car, packing).
exports.rhaiSessionReminders = onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
    secrets: [CRON_SECRET],
    timeoutSeconds: 300,
    memory: '256MiB'
  },
  () => hitCron('/api/rhai/cron/session-reminders', CRON_SECRET.value())
);

// Every 15 min — WhatsApp pre-call briefings for calls ~1 hour out.
exports.rhaiBriefings = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
    secrets: [CRON_SECRET],
    timeoutSeconds: 300,
    memory: '256MiB'
  },
  () => hitCron('/api/rhai/cron/briefings', CRON_SECRET.value())
);
