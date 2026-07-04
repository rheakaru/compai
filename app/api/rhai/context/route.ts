import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { COL_CONTEXT, generateDigest, loadContextSections, requireOperator } from '@/lib/rhai/server';
import { SECTION_MODE } from '@/lib/rhai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  return Response.json({ sections: await loadContextSections() });
}

/** Upsert one section: { id, title?, body }. Library sections re-digest on meaningful change. */
export async function PUT(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as { id?: string; title?: string; body?: string };
  if (!body.id || typeof body.body !== 'string') {
    return new Response('expected { id, body }', { status: 400 });
  }

  const ref = adminDb().collection(COL_CONTEXT).doc(body.id);
  const update: Record<string, unknown> = { body: body.body, updatedAt: Date.now() };
  if (body.title) update.title = body.title;

  // Library docs carry an always-loaded digest card. Regenerate it when the
  // body meaningfully changed (>5% length delta or no digest yet) — cheap
  // Haiku call, and autosave debouncing keeps this rare.
  if (SECTION_MODE[body.id] === 'library' && body.body.trim()) {
    const prev = (await ref.get()).data() as { body?: string; digest?: string } | undefined;
    const prevLen = prev?.body?.length ?? 0;
    const delta = Math.abs(body.body.length - prevLen);
    if (!prev?.digest || delta > Math.max(500, prevLen * 0.05)) {
      try {
        update.digest = await generateDigest(body.title ?? body.id, body.body);
      } catch {
        // digest is best-effort; the prompt builder handles its absence
      }
    }
  }

  await ref.set(update, { merge: true });
  return Response.json({ ok: true, digest: update.digest });
}
