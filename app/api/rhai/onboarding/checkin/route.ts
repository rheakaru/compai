import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { ONBOARDING_TOKEN, INTERN } from '@/lib/rhai/onboarding';
import { sendWhatsAppText, sendWhatsAppTemplate } from '@/lib/rhai/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The intern's daily check-ins. Saved under the onboarding doc, mirrored to
// rhaiTodos so they're never lost, AND pushed to Rhea on WhatsApp.
//
// WhatsApp delivery: a free-form (session) message only reaches Rhea inside the
// 24h window since she last messaged the Rhai number — outside it, Meta drops it
// silently. So if WHATSAPP_CHECKIN_TEMPLATE is set (a pre-approved template), we
// send that FIRST (it delivers any time); the session text is the fallback and
// carries the full note when the window is open.
const COL = 'rhaiOnboarding';
const COL_TODOS = 'rhaiTodos';
const ADMIN_LINK = 'https://heyrhai.com/admin/orientation';

function istDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: string; kind?: string; text?: string };
  if (body.token !== ONBOARDING_TOKEN) return new Response('forbidden', { status: 403 });
  const kind = body.kind === 'evening' ? 'evening' : 'morning';
  const text = String(body.text || '').trim().slice(0, 3000);
  if (!text) return new Response('empty', { status: 400 });

  const date = istDate();
  const now = Date.now();
  const who = INTERN.name || 'The intern';
  const kindLabel = kind === 'morning' ? 'morning plan' : 'end-of-day';

  await adminDb()
    .collection(COL)
    .doc(ONBOARDING_TOKEN)
    .set({ checkins: { [date]: { [kind]: { text, at: now } } }, updatedAt: now }, { merge: true });

  // Never-lost fallback: also drop it on the Today list, so it's visible in the
  // dashboard even if the WhatsApp push is outside the 24h window.
  try {
    await adminDb().collection(COL_TODOS).add({
      text: `${who} — ${kindLabel} (${date}): ${text}`.slice(0, 3500),
      done: false,
      createdAt: now,
      updatedAt: now
    });
  } catch {
    /* best-effort */
  }

  const to = (process.env.WHATSAPP_BRIEFING_TO || (process.env.WHATSAPP_ALLOWED_NUMBERS || '').split(',')[0] || '').trim();
  let delivered: 'template' | 'session-attempted' | 'none' = 'none';
  if (to) {
    // 1) Template first — reliable outside the 24h window. Params kept short and
    //    single-line (template vars can't contain newlines): who · kind · date.
    const template = process.env.WHATSAPP_CHECKIN_TEMPLATE;
    if (template && (await sendWhatsAppTemplate(to, template, [who, kindLabel, date]).catch(() => false))) {
      delivered = 'template';
    }
    // 2) Session message with the full note + a link. Delivers only in-window,
    //    but when it does, Rhea gets the whole thing without opening anything.
    const header = kind === 'morning' ? `🌅 ${who} — morning plan (${date})` : `🌙 ${who} — end of day (${date})`;
    try {
      await sendWhatsAppText(to, `${header}\n\n${text}\n\nAll check-ins: ${ADMIN_LINK}`);
      if (delivered === 'none') delivered = 'session-attempted';
    } catch {
      /* saved + on the Today list regardless */
    }
  }
  return Response.json({ ok: true, delivered });
}
