import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { modelFor } from '@/lib/rhai/models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Transcribe photos of handwritten call notes into clean text that lands in a
// lead's smart-notes. Operator-only. The lead id in the path is used only for
// the auth gate + logging context; the client decides how to merge the result
// into the notes it saves (keeping the human in the loop — "always draft").

const MAX_IMAGES = 8;
type MediaType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
const SUPPORTED = new Set<MediaType>(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

type ImageBlock = { type: 'image'; source: { type: 'base64'; media_type: MediaType; data: string } };

/** Parse a `data:image/...;base64,....` URL into an Anthropic image block. */
function toImageBlock(dataUrl: string): ImageBlock | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl.trim());
  if (!m) return null;
  const mediaType = m[1].toLowerCase() as MediaType;
  if (!SUPPORTED.has(mediaType)) return null;
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data: m[2] } };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) return new Response('unauthorized', { status: 401 });
  if (!user.operator) return new Response('forbidden — operator only', { status: 403 });
  await ctx.params; // lead id — reserved for future per-lead context

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response('ANTHROPIC_API_KEY not set', { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { images?: string[] };
  const urls = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
  const blocks = urls.map(toImageBlock).filter((b): b is ImageBlock => b !== null);
  if (blocks.length === 0) {
    return new Response('no valid images (expected base64 data URLs: png/jpeg/gif/webp)', { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: modelFor('transcribe'),
    max_tokens: 2000,
    system:
      "You transcribe photos of Rhea's handwritten notes from client discovery calls and recce visits. " +
      'Return ONLY the transcribed text as clean, readable Markdown — preserve bullet points, headings, arrows, ' +
      'and any "action item" / "TODO" markers the way they were written. Keep her shorthand meaning but expand ' +
      'obvious abbreviations. If several photos are pages of one note, transcribe them in order as one document. ' +
      'Do not add commentary, do not summarise, do not invent anything you cannot read — mark illegible words as [?].',
    messages: [
      {
        role: 'user',
        content: [
          ...blocks,
          { type: 'text', text: 'Transcribe these handwritten notes into clean Markdown.' }
        ]
      }
    ]
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();

  return Response.json({ text });
}
