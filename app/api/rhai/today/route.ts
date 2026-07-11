import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  COL_IDEAS,
  COL_SUGGESTIONS,
  buildRhaiSystemPrompt,
  describeIdeas,
  describeLeads,
  loadContextSections,
  parseJsonLoose,
  requireOperator,
  runRhaiWithContext
} from '@/lib/rhai/server';
import { modelFor } from '@/lib/rhai/models';
import { normalizeLead, type WorkshopLead } from '@/lib/leads/types';
import {
  SUGGESTION_KIND_LABELS,
  type RhaiIdea,
  type RhaiSuggestion,
  type SuggestionKind
} from '@/lib/rhai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// The "Today" panel — Rhai's proactive pass over the whole business. POST
// regenerates: it reads the pipeline (incl. smart notes), parked ideas, and
// the context vault, then proposes concrete next actions. Draft-only: each
// suggestion is `proposed` until Rhea approves (queues it for the Claude Code
// hands) or dismisses it.

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const snap = await adminDb().collection(COL_SUGGESTIONS).orderBy('createdAt', 'desc').limit(60).get();
  const suggestions = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RhaiSuggestion, 'id'>) }));
  return Response.json({ suggestions });
}

export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const db = adminDb();
  const [leadsSnap, ideasSnap, tasksSnap, historySnap, sections] = await Promise.all([
    db.collection('workshopLeads').orderBy('createdAt', 'desc').get(),
    db.collection(COL_IDEAS).orderBy('createdAt', 'desc').get(),
    db.collection('rhaiTasks').where('status', '==', 'queued').get(),
    // Rhai's own memory: what Rhea already did (done) or rejected (dismissed),
    // so the pass never re-proposes handled or unwanted work. Single-field
    // order → no composite index; split by status in memory.
    db.collection(COL_SUGGESTIONS).orderBy('updatedAt', 'desc').limit(250).get(),
    loadContextSections()
  ]);
  const leads = leadsSnap.docs.map(d =>
    normalizeLead({ id: d.id, ...(d.data() as Omit<WorkshopLead, 'id'>) } as WorkshopLead & { type: string })
  );
  const ideas = ideasSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RhaiIdea, 'id'>) }));
  const queuedTasks = tasksSnap.docs.map(d => {
    const t = d.data() as { title?: string; leadLabel?: string; createdAt?: number };
    const ageDays = Math.floor((Date.now() - (t.createdAt ?? Date.now())) / 86400_000);
    return `• "${t.title}"${t.leadLabel ? ` (${t.leadLabel})` : ''}${ageDays >= 1 ? ` — queued ${ageDays}d, not yet run` : ''}`;
  });

  // Rhai's memory of Rhea's own decisions on past suggestions.
  const history = historySnap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<RhaiSuggestion, 'id'>) }))
    .filter(s => s.status === 'done' || s.status === 'dismissed');
  const line = (s: RhaiSuggestion) => `• ${s.title}${s.leadLabel ? ` (${s.leadLabel})` : ''}`;
  const doneList = history.filter(s => s.status === 'done').slice(0, 80).map(line);
  const dismissedList = history.filter(s => s.status === 'dismissed').slice(0, 80).map(line);

  // Suppression keys — a backstop in case the model rewords a handled item.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 50);
  const suppressedLeadKeys = new Set(history.filter(h => h.leadId).map(h => `${h.leadId}|${norm(h.title)}`));
  const suppressedGlobalTitles = new Set(history.filter(h => !h.leadId).map(h => norm(h.title)));

  const kinds = Object.keys(SUGGESTION_KIND_LABELS).join(' | ');
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const text = await runRhaiWithContext({
    model: modelFor('suggest'),
    maxTokens: 3000,
    system: buildRhaiSystemPrompt(sections),
    userContent: [
      `Today is ${today}. Do your morning cofounder pass.`,
      `\nPIPELINE:\n${describeLeads(leads)}`,
      `\nPARKED IDEAS:\n${describeIdeas(ideas)}`,
      queuedTasks.length ? `\nTASKS QUEUED ON YOUR BOARD (not yet run):\n${queuedTasks.join('\n')}` : '',
      doneList.length
        ? `\nALREADY DONE — Rhea has completed these. Do NOT propose them, or lightly-reworded versions, again:\n${doneList.join('\n')}`
        : '',
      dismissedList.length
        ? `\nDISMISSED — Rhea judged these NOT relevant / not worth doing. Do NOT propose these, or variants, ever again:\n${dismissedList.join('\n')}`
        : '',
      `\nPropose the 4-8 highest-leverage actions for today. Rules:`,
      `- MEMORY (critical): never re-propose anything in ALREADY DONE or DISMISSED above, nor a reworded variant. If a completed step has a genuine follow-on, propose the NEW next step — not the same one. If everything actionable is already done/dismissed, propose fewer items (or top-of-funnel plays) rather than repeating.`,
      `- Concrete and immediately actionable; name the lead/person and the exact artifact ("draft X for Y because Z").`,
      `- Read the smart notes: client wants mentioned there (e.g. a WhatsApp morning briefing) should become research/prep suggestions.`,
      `- Chase money first (unpaid invoices, stalled hot leads), then session prep, then top-of-funnel (ideas, networks, Hang with AI).`,
      `- RIPENESS: flag things that crossed the line from thinking to acting — a brainstormed idea whose questions got answered should be promoted to the pipeline; a queued task sitting >1 day should be run; a lead with rich notes but no scan/understanding should get one. Say so explicitly.`,
      `- If the pipeline is quiet, surface parked ideas and network plays — read_context("community") for who to tap.`,
      `- Never suggest sending anything to a client directly — you draft, Rhea approves.`,
      `\nAfter any tool use, return ONLY a JSON array: [{"kind": "${kinds}", "title": "…", "detail": "why + exactly what you'll prepare if approved", "leadId": "<id or omit>", "leadLabel": "<person/company or omit>"}]`
    ].join('\n')
  });

  let proposed: Array<{ kind: SuggestionKind; title: string; detail: string; leadId?: string; leadLabel?: string }>;
  try {
    proposed = parseJsonLoose(text);
    if (!Array.isArray(proposed)) throw new Error('not an array');
  } catch {
    return new Response('Rhai returned malformed suggestions — try again', { status: 502 });
  }

  // Replace yesterday's un-actioned proposals; approved/dismissed/done are history.
  const now = Date.now();
  const batch = db.batch();
  const stale = await db.collection(COL_SUGGESTIONS).where('status', '==', 'proposed').get();
  stale.docs.forEach(d => batch.delete(d.ref));

  const validKinds = new Set(Object.keys(SUGGESTION_KIND_LABELS));
  const leadIds = new Set(leads.map(l => l.id));
  const created: RhaiSuggestion[] = [];
  for (const p of proposed.slice(0, 10)) {
    if (!p?.title || !p?.detail) continue;
    const leadId = p.leadId && leadIds.has(p.leadId) ? p.leadId : undefined;
    // Backstop: drop anything Rhea already did or dismissed (model reworded it).
    const nt = norm(String(p.title));
    if (leadId ? suppressedLeadKeys.has(`${leadId}|${nt}`) : suppressedGlobalTitles.has(nt)) continue;
    const doc: Omit<RhaiSuggestion, 'id'> = {
      kind: validKinds.has(p.kind) ? p.kind : 'follow_up',
      title: String(p.title).slice(0, 200),
      detail: String(p.detail).slice(0, 2000),
      ...(leadId ? { leadId } : {}),
      ...(p.leadLabel ? { leadLabel: String(p.leadLabel).slice(0, 120) } : {}),
      status: 'proposed',
      createdAt: now,
      updatedAt: now
    };
    const ref = db.collection(COL_SUGGESTIONS).doc();
    batch.set(ref, doc);
    created.push({ id: ref.id, ...doc });
  }
  await batch.commit();

  return Response.json({ suggestions: created });
}

/** Approve / dismiss / complete a suggestion: { id, status }. */
export async function PATCH(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as { id?: string; status?: RhaiSuggestion['status'] };
  if (!body.id || !body.status || !['approved', 'dismissed', 'done', 'proposed'].includes(body.status)) {
    return new Response('expected { id, status }', { status: 400 });
  }
  const db = adminDb();
  const ref = db.collection(COL_SUGGESTIONS).doc(body.id);
  const snap = await ref.get();
  if (!snap.exists) return new Response('not found', { status: 404 });
  const s = snap.data() as Omit<RhaiSuggestion, 'id'>;
  const now = Date.now();
  await ref.set({ status: body.status, updatedAt: now }, { merge: true });

  // "Done means I did it" — record the completed step on the linked lead's
  // timeline, so Rhea has the trail AND Rhai's client context knows it's
  // handled (buildLeadContext reads note sessions). Only on the done edge, and
  // only if not already recorded (idempotent on repeated PATCHes).
  if (body.status === 'done' && s.leadId && s.status !== 'done') {
    await db
      .collection('workshopLeads')
      .doc(s.leadId)
      .collection('noteSessions')
      .add({
        text: `✓ Completed: ${s.title}${s.detail ? `\n${s.detail.slice(0, 500)}` : ''}`,
        source: 'rhai-done',
        label: s.title.slice(0, 80),
        at: now
      })
      .catch(() => undefined);
  }
  return Response.json({ ok: true });
}
