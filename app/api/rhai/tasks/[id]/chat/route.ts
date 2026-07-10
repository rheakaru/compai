import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { buildRhaiSystemPrompt, loadContextSections, requireOperator, runRhaiWithContext } from '@/lib/rhai/server';
import { buildLeadContext } from '@/lib/rhai/leadContext';
import { modelFor } from '@/lib/rhai/models';
import type { RhaiTask } from '@/lib/rhai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const RESULT_MARKER = '---RESULT---';

// Chat on a completed task: Rhea asks Rhai to tweak the deliverable (or asks a
// question about it). Rhai replies conversationally and, when it's an edit,
// returns the COMPLETE revised deliverable, which replaces the stored result
// (and the linked client document, if any).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as { message?: string };
  const message = body.message?.trim().slice(0, 4000);
  if (!message) return new Response('expected { message }', { status: 400 });

  const db = adminDb();
  const ref = db.collection('rhaiTasks').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return new Response('not found', { status: 404 });
  const task = { id, ...(snap.data() as Omit<RhaiTask, 'id'>) };

  let leadContext = '';
  if (task.leadId) {
    const built = await buildLeadContext(task.leadId).catch(() => null);
    if (built) leadContext = built.context;
  }

  const priorChat = (task.chat ?? [])
    .slice(-8)
    .map(m => `${m.role === 'rhai' ? 'RHAI' : 'RHEA'}: ${m.text}`)
    .join('\n');

  const sections = await loadContextSections();

  const raw = await runRhaiWithContext({
    model: modelFor('draft'),
    maxTokens: 4000,
    system: buildRhaiSystemPrompt(sections),
    userContent: [
      `Rhea is iterating with you on a deliverable you produced. Help her refine it.`,
      ``,
      `THE ORIGINAL TASK / PROMPT:\n${task.detail || task.title}`,
      leadContext ? `\n${leadContext}` : '',
      ``,
      `THE CURRENT DELIVERABLE:\n${(task.result ?? '(none yet)').slice(0, 24_000)}`,
      priorChat ? `\n\nEARLIER IN THIS CHAT:\n${priorChat}` : '',
      ``,
      `RHEA NOW SAYS:\n${message}`,
      ``,
      `RESPOND IN THIS EXACT SHAPE:`,
      `- First, a brief chat reply (1–3 sentences): what you changed, or your answer if she only asked a question.`,
      `- If (and only if) she asked for a change to the deliverable, then a line containing ONLY "${RESULT_MARKER}", then the COMPLETE revised deliverable in markdown (the whole thing, not a diff — it replaces the old one).`,
      `- If she only asked a question and no edit is needed, omit the marker and the second part entirely.`
    ]
      .filter(Boolean)
      .join('\n')
  });

  // Split reply from (optional) new deliverable.
  const markerIdx = raw.indexOf(RESULT_MARKER);
  let reply = raw.trim();
  let updatedResult: string | undefined;
  if (markerIdx !== -1) {
    reply = raw.slice(0, markerIdx).trim();
    const rest = raw.slice(markerIdx + RESULT_MARKER.length).trim();
    if (rest) updatedResult = rest.slice(0, 30_000);
  }
  if (!reply) reply = updatedResult ? 'Done — updated the deliverable above.' : '…';

  const now = Date.now();
  const chat = [
    ...(task.chat ?? []),
    { role: 'rhea' as const, text: message, at: now },
    { role: 'rhai' as const, text: reply, at: now }
  ].slice(-40);

  const update: Record<string, unknown> = { chat };
  if (updatedResult) update.result = updatedResult;
  await ref.set(update, { merge: true });

  // Keep the linked client document in sync when the deliverable changed.
  if (updatedResult && task.leadId && task.documentId) {
    await db
      .collection('workshopLeads')
      .doc(task.leadId)
      .collection('documents')
      .doc(task.documentId)
      .set({ text: updatedResult, updatedAt: now }, { merge: true })
      .catch(() => undefined);
  }

  return Response.json({ reply, updatedResult: updatedResult ?? null });
}
