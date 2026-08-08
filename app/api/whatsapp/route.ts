import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  buildWhatsappReply,
  downloadWhatsAppMedia,
  handleWhatsAppAttachment,
  isAllowedSender,
  sendWhatsAppText,
  transcribeWhatsAppAudio,
  verifySignature
} from '@/lib/rhai/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Meta WhatsApp Cloud API webhook. GET verifies the subscription; POST receives
// messages, routes Rhea's (and only Rhea's) into Rhai, and replies. Inert until
// the WHATSAPP_* env vars are configured — safe to deploy unconfigured.

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (p.get('hub.mode') === 'subscribe' && expected && p.get('hub.verify_token') === expected) {
    return new Response(p.get('hub.challenge') ?? '', { status: 200 });
  }
  return new Response('forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'))) {
    return new Response('bad signature', { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response('ok'); // ack malformed so Meta doesn't retry forever
  }

  const value = (payload as WebhookPayload)?.entry?.[0]?.changes?.[0]?.value;
  const messages = value?.messages;
  // Status callbacks (delivered/read) and other events have no `messages`.
  if (!Array.isArray(messages) || messages.length === 0) return new Response('ok');
  const contactName = value?.contacts?.[0]?.profile?.name;

  for (const m of messages) {
    try {
      await handleMessage(m, contactName);
    } catch {
      // Swallow — always ack, so Meta doesn't storm retries.
    }
  }
  return new Response('ok');
}

async function handleMessage(m: InboundMessage, name?: string): Promise<void> {
  const from = String(m.from ?? '');
  if (!from || !isAllowedSender(from)) return; // strangers are ignored silently
  const msgId = String(m.id ?? '');
  if (!msgId) return;

  // Idempotency — Meta may redeliver. First writer wins; the rest no-op.
  try {
    await adminDb().collection('rhaiWhatsappProcessed').doc(msgId).create({ at: Date.now() });
  } catch {
    return; // already handled
  }

  let text = '';
  if (m.type === 'text') {
    text = String(m.text?.body ?? '').trim();
  } else if (m.type === 'audio' || m.type === 'voice') {
    const mediaId = String(m.audio?.id ?? m.voice?.id ?? '');
    const t = await transcribeWhatsAppAudio(mediaId);
    if (!t) {
      await sendWhatsAppText(from, "I couldn't quite catch that — mind typing it or resending the voice note?");
      return;
    }
    text = t;
  } else if (m.type === 'image' || m.type === 'document') {
    // A photo/PDF → classified and routed: flight/train tickets go onto the
    // calendar (if not already there) + travel tracker; receipts land in the
    // cost tracker. Caption becomes the note.
    const mediaId = String(m.image?.id ?? m.document?.id ?? '');
    const caption = String(m.image?.caption ?? m.document?.caption ?? '').trim();
    const media = mediaId ? await downloadWhatsAppMedia(mediaId) : null;
    if (!media) {
      await sendWhatsAppText(from, "Couldn't download that file — mind resending it?");
      return;
    }
    const reply = await handleWhatsAppAttachment(media, caption || undefined);
    await sendWhatsAppText(from, reply);
    return;
  } else {
    await sendWhatsAppText(
      from,
      'Send me a task, an idea, or a question — text and voice notes work, and a photo of a receipt gets logged as a cost.'
    );
    return;
  }

  if (!text) return;
  const reply = await buildWhatsappReply({ from, name, text });
  await sendWhatsAppText(from, reply);
}

// ---- minimal shapes of the Meta webhook payload we read ----
interface InboundMessage {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  audio?: { id?: string };
  voice?: { id?: string };
  image?: { id?: string; caption?: string };
  document?: { id?: string; caption?: string };
}
interface WebhookPayload {
  entry?: {
    changes?: {
      value?: {
        contacts?: { profile?: { name?: string } }[];
        messages?: InboundMessage[];
      };
    }[];
  }[];
}
