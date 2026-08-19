import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  buildWhatsappReply,
  downloadWhatsAppMedia,
  groupMessageNeedsReply,
  groupTrigger,
  handleWhatsAppAttachment,
  isAllowedGroup,
  isAllowedSender,
  recentGroupMessages,
  recordGroupMessage,
  sendWhatsAppText,
  transcribeWhatsAppAudio,
  verifySignature
} from '@/lib/rhai/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Meta WhatsApp Cloud API webhook. GET verifies the subscription; POST receives
// messages and routes them into Rhai. Inert until the WHATSAPP_* env vars are
// configured — safe to deploy unconfigured.
//
// Two channels, two rules:
//   1:1   — only Rhea (WHATSAPP_ALLOWED_NUMBERS); every message gets a reply.
//   group — only allow-listed groups (WHATSAPP_ALLOWED_GROUPS); the agent stays
//           quiet unless it is tagged, or Rhea is named and triage decides the
//           message actually wants an answer. Everything else is remembered.

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
  const groupId = String(m.group_id ?? '').trim();
  const isGroup = !!groupId;

  // Default-closed on both channels: an unknown group is ignored exactly like
  // an unknown sender, so being added to a random group does nothing.
  if (isGroup ? !isAllowedGroup(groupId) : !from || !isAllowedSender(from)) return;
  if (!from) return;
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
      // In a group, a failed transcription is other people's noise — stay quiet.
      if (!isGroup) {
        await sendWhatsAppText(from, "I couldn't quite catch that — mind typing it or resending the voice note?");
      }
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
      if (!isGroup) await sendWhatsAppText(from, "Couldn't download that file — mind resending it?");
      return;
    }
    // Tickets and receipts are acted on wherever they land — a boarding pass
    // dropped in the team group still belongs on the calendar.
    const reply = await handleWhatsAppAttachment(media, caption || undefined);
    await sendWhatsAppText(isGroup ? groupId : from, reply, isGroup);
    return;
  } else {
    // Stickers, contacts, locations… nothing to route. Only explain in 1:1.
    if (!isGroup) {
      await sendWhatsAppText(
        from,
        'Send me a task, an idea, or a question — text and voice notes work, and a photo of a receipt gets logged as a cost.'
      );
    }
    return;
  }

  if (!text) return;

  if (isGroup) {
    const trigger = groupTrigger(text);
    if (trigger === 'listen') {
      await recordGroupMessage(groupId, name ?? from, text);
      return;
    }
    if (trigger === 'rhea-named') {
      const recent = await recentGroupMessages(groupId);
      const verdict = await groupMessageNeedsReply(text, recent);
      if (!verdict.reply) {
        await recordGroupMessage(groupId, name ?? from, text);
        return;
      }
    }
    const reply = await buildWhatsappReply({ from, name, text, groupId });
    await sendWhatsAppText(groupId, reply, true);
    return;
  }

  const reply = await buildWhatsappReply({ from, name, text });
  await sendWhatsAppText(from, reply);
}

// ---- minimal shapes of the Meta webhook payload we read ----
interface InboundMessage {
  from?: string;
  /** Present only on group messages — the group's opaque id. */
  group_id?: string;
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
