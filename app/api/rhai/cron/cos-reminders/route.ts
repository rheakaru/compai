import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { COL_REMINDERS } from '@/lib/cos/store';
import { sendWhatsAppText } from '@/lib/rhai/whatsapp';

// Chief of Staff reminders — hit every few minutes by the scheduler with
// `x-cron-secret`. Sends every due, unsent reminder as a free-form WhatsApp
// message. Honest constraint: Meta only delivers free-form messages inside
// the 24h window after the person last messaged the number. During and right
// after the workshop that window is open; for reminders further out a
// pre-approved template (WHATSAPP_COS_TEMPLATE) is the reliable path.

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response('forbidden', { status: 403 });
  }
  const db = adminDb();
  const now = Date.now();
  // Single-field query (no composite index needed); a sent reminder is
  // deleted, so anything still here is pending.
  const due = await db.collection(COL_REMINDERS).where('dueAt', '<=', now).limit(100).get();

  let sent = 0;
  for (const doc of due.docs) {
    const r = doc.data() as { to: string; text: string };
    try {
      await sendWhatsAppText(r.to, `⏰ Reminder: ${r.text}`);
      await doc.ref.delete();
      sent++;
    } catch {
      // leave it; next tick retries
    }
  }
  return NextResponse.json({ ok: true, due: due.size, sent });
}
