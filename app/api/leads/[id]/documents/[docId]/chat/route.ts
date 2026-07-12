import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  buildRhaiSystemPrompt,
  loadContextSections,
  loadDocPreferences,
  recordDocPreference,
  requireOperator,
  runRhaiWithContext
} from '@/lib/rhai/server';
import { buildLeadContext } from '@/lib/rhai/leadContext';
import { modelFor } from '@/lib/rhai/models';
import type { LeadDocument } from '@/lib/leads/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DOC_MARKER = '---DOCUMENT---';

// Chat to iterate on a client document (the full-page view). Rhea asks Rhai to
// edit or explain; Rhai replies conversationally and, for a GENERATED doc,
// returns the COMPLETE revised document which replaces the text (prior version
// archived, and a durable preference distilled — same learning loop as refine).
// Uploaded source files can be discussed but not rewritten.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id, docId } = await ctx.params;

  const message = ((await req.json().catch(() => ({}))) as { message?: string }).message?.trim().slice(0, 4000);
  if (!message) return new Response('expected { message }', { status: 400 });

  const ref = adminDb().collection('workshopLeads').doc(id).collection('documents').doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return new Response('not found', { status: 404 });
  const doc = { id: docId, ...(snap.data() as Omit<LeadDocument, 'id'>) };
  const editable = doc.origin === 'generated';

  const [sections, leadCtx, prefs] = await Promise.all([
    loadContextSections(),
    buildLeadContext(id).catch(() => null),
    editable ? loadDocPreferences() : Promise.resolve('')
  ]);

  const priorChat = (doc.chat ?? [])
    .slice(-8)
    .map(m => `${m.role === 'rhai' ? 'RHAI' : 'RHEA'}: ${m.text}`)
    .join('\n');

  const raw = await runRhaiWithContext({
    model: modelFor('research'),
    maxTokens: 4000,
    system:
      buildRhaiSystemPrompt(sections) +
      (prefs ? `\n\nRHEA'S DOCUMENT PREFERENCES (learned from past feedback — always apply):\n${prefs}` : ''),
    userContent: [
      `Rhea is iterating with you on a client document. Help her refine it.`,
      leadCtx ? `\nCLIENT CONTEXT:\n${leadCtx.context.slice(0, 8000)}` : '',
      ``,
      `DOCUMENT (${doc.name}) — ${editable ? 'a draft you generated; editable' : 'an uploaded source file; discuss it but do NOT rewrite it'}:`,
      doc.text.slice(0, 24_000),
      priorChat ? `\n\nEARLIER IN THIS CHAT:\n${priorChat}` : '',
      ``,
      `RHEA NOW SAYS:\n${message}`,
      ``,
      `RESPOND IN THIS EXACT SHAPE:`,
      `- First, a brief chat reply (1–3 sentences): what you changed, or your answer if she only asked a question.`,
      editable
        ? `- If (and only if) she asked for a change, then a line containing ONLY "${DOC_MARKER}", then the COMPLETE revised document in clean markdown (the whole thing, ready to send to a client — no preamble).`
        : `- This is an uploaded file, so never output a rewritten document — just answer.`
    ]
      .filter(Boolean)
      .join('\n')
  });

  const markerIdx = editable ? raw.indexOf(DOC_MARKER) : -1;
  let reply = raw.trim();
  let updatedText: string | undefined;
  if (markerIdx !== -1) {
    reply = raw.slice(0, markerIdx).trim();
    const rest = raw.slice(markerIdx + DOC_MARKER.length).trim();
    if (rest) updatedText = rest.slice(0, 40_000);
  }
  if (!reply) reply = updatedText ? 'Done — updated the document above.' : '…';

  const now = Date.now();
  const chat = [
    ...(doc.chat ?? []),
    { role: 'rhea' as const, text: message, at: now },
    { role: 'rhai' as const, text: reply, at: now }
  ].slice(-40);

  const update: Record<string, unknown> = { chat, updatedAt: now };
  if (updatedText) {
    update.text = updatedText;
    update.versions = [...(doc.versions ?? []), { text: doc.text, note: message.slice(0, 300), at: now }].slice(-10);
  }
  await ref.set(update, { merge: true });

  // Learning loop — same as refine: distil a durable preference on edits.
  if (updatedText) recordDocPreference(message, doc.name).catch(() => undefined);

  return Response.json({ reply, updatedText: updatedText ?? null });
}
