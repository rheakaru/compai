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

// Iterate on a generated document with Rhai — "like creating documents in
// Claude chat". Feedback rewrites the doc (prior version archived) AND makes
// Rhai smarter: a durable preference is distilled and stored, so every future
// document generation applies it.

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id, docId } = await ctx.params;

  const feedback = ((await req.json().catch(() => ({}))) as { feedback?: string }).feedback?.trim();
  if (!feedback) return new Response('expected { feedback }', { status: 400 });

  const ref = adminDb().collection('workshopLeads').doc(id).collection('documents').doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return new Response('not found', { status: 404 });
  const doc = { id: docId, ...(snap.data() as Omit<LeadDocument, 'id'>) };
  if (doc.origin !== 'generated') return new Response('only generated documents can be refined', { status: 400 });

  const [sections, leadCtx, prefs] = await Promise.all([
    loadContextSections(),
    buildLeadContext(id),
    loadDocPreferences()
  ]);

  const revised = await runRhaiWithContext({
    model: modelFor('research'),
    maxTokens: 4000,
    system:
      buildRhaiSystemPrompt(sections) +
      (prefs ? `\n\nRHEA'S DOCUMENT PREFERENCES (learned from past feedback — always apply):\n${prefs}` : ''),
    userContent: [
      `Revise this document per Rhea's feedback. Return ONLY the full revised document in clean markdown — no preamble, no "here's the revised version", just the document itself, ready to send to a client.`,
      leadCtx ? `\nCLIENT CONTEXT:\n${leadCtx.context.slice(0, 8000)}` : '',
      `\nCURRENT DOCUMENT (${doc.name}):\n${doc.text}`,
      `\nRHEA'S FEEDBACK:\n${feedback}`
    ]
      .filter(Boolean)
      .join('\n')
  });

  const now = Date.now();
  await ref.set(
    {
      text: revised.trim(),
      versions: [...(doc.versions ?? []), { text: doc.text, note: feedback.slice(0, 300), at: now }].slice(-10),
      updatedAt: now
    },
    { merge: true }
  );

  // The learning loop — distil a durable preference from this feedback so
  // future documents start closer to what Rhea wants.
  recordDocPreference(feedback, doc.name).catch(() => undefined);

  return Response.json({ document: { ...doc, text: revised.trim() } });
}
