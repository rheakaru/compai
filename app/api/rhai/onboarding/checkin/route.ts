import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { ONBOARDING_TOKEN, INTERN } from '@/lib/rhai/onboarding';
import { sendWhatsAppText } from '@/lib/rhai/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The intern's daily check-ins. Saved under the onboarding doc AND pushed to
// Rhea on WhatsApp via the Rhai number, so a morning "here's my plan" and an
// EOD "here's what I did" reach her without the intern needing an account.
const COL = 'rhaiOnboarding';

function istDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: string; kind?: string; text?: string };
  if (body.token !== ONBOARDING_TOKEN) return new Response('forbidden', { status: 403 });
  const kind = body.kind === 'evening' ? 'evening' : 'morning';
  const text = String(body.text || '').trim().slice(0, 3000);
  if (!text) return new Response('empty', { status: 400 });

  const date = istDate();
  const now = Date.now();
  await adminDb()
    .collection(COL)
    .doc(ONBOARDING_TOKEN)
    .set({ checkins: { [date]: { [kind]: { text, at: now } } }, updatedAt: now }, { merge: true });

  // Push to Rhea. WHATSAPP_BRIEFING_TO is her number; falls back to the first
  // allowed number. Best-effort — the check-in is saved regardless.
  const to = (process.env.WHATSAPP_BRIEFING_TO || (process.env.WHATSAPP_ALLOWED_NUMBERS || '').split(',')[0] || '').trim();
  const who = INTERN.name || 'The intern';
  const header = kind === 'morning' ? `🌅 ${who} — morning plan (${date})` : `🌙 ${who} — end of day (${date})`;
  if (to) {
    try {
      await sendWhatsAppText(to, `${header}\n\n${text}`);
    } catch {
      /* saved anyway */
    }
  }
  return Response.json({ ok: true });
}
