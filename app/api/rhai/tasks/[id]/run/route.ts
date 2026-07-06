import { NextRequest } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase/admin';
import {
  DOC_SKILLS,
  buildRhaiSystemPrompt,
  loadContextSections,
  loadDocPreferences,
  requireOperator,
  runRhaiWithContext
} from '@/lib/rhai/server';
import { buildLeadContext } from '@/lib/rhai/leadContext';
import { modelFor } from '@/lib/rhai/models';
import type { RhaiSkill, RhaiTask } from '@/lib/rhai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Execute one Rhai task. The client's full context (understanding + every
// note session) rides along when the task is lead-linked; the skill registry
// shapes the output and picks the model; library docs are one tool call away.
// Fire several /run calls in parallel — each serverless invocation is its own
// worker.

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;

  const db = adminDb();
  const ref = db.collection('rhaiTasks').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return new Response('not found', { status: 404 });
  const task = { id, ...(snap.data() as Omit<RhaiTask, 'id'>) };
  if (task.status === 'running') return new Response('already running', { status: 409 });

  await ref.set({ status: 'running', startedAt: Date.now() }, { merge: true });

  try {
    // Client context, if lead-linked.
    let leadContext = '';
    if (task.leadId) {
      const built = await buildLeadContext(task.leadId);
      if (built) leadContext = built.context;
    }

    // Skill framing + model from the registry.
    let skillNote = '';
    let model = modelFor('research');
    if (task.skillId) {
      const skillsSnap = await db.doc(DOC_SKILLS).get();
      const skills = (skillsSnap.data()?.skills ?? []) as RhaiSkill[];
      const skill = skills.find(s => s.id === task.skillId);
      if (skill) {
        skillNote = `SKILL FRAMING — "${skill.name}": ${skill.description}\nShape the output the way this skill would.`;
        model = skill.model || model;
      }
    }

    // Non-research, lead-linked tasks produce a shareable document — apply
    // Rhea's learned document preferences.
    const producesDoc = !!task.leadId && !task.appendToNotes;
    const [sections, docPrefs] = await Promise.all([
      loadContextSections(),
      producesDoc ? loadDocPreferences() : Promise.resolve('')
    ]);
    const result = await runRhaiWithContext({
      model,
      maxTokens: 4000,
      system:
        buildRhaiSystemPrompt(sections) +
        (docPrefs ? `\n\nRHEA'S DOCUMENT PREFERENCES (learned from past feedback — always apply):\n${docPrefs}` : ''),
      extraTools: [
        { type: 'web_search_20250305', name: 'web_search', max_uses: 8 } as unknown as Anthropic.Messages.Tool
      ],
      userContent: [
        `Execute this task assigned to you on the task board. Produce the complete deliverable — not a plan to do it.`,
        ``,
        `TASK: ${task.title}`,
        task.detail && task.detail !== task.title ? `DETAIL: ${task.detail}` : '',
        skillNote,
        leadContext ? `\n${leadContext}` : '',
        ``,
        `Use web_search for anything external (industry data, the client's company, solution research). read_context("demos"/"projects"/"teaching") when relevant — cite when we've built a pattern before. Output in markdown. If it's a draft (email/proposal), produce the full draft ready for Rhea's review — remember nothing goes out without her.`
      ]
        .filter(Boolean)
        .join('\n')
    });

    const update: Record<string, unknown> = {
      status: 'done',
      result: result.slice(0, 30_000),
      finishedAt: Date.now()
    };
    await ref.set(update, { merge: true });

    const now = Date.now();
    if (task.leadId && result.trim()) {
      if (task.appendToNotes) {
        // Research → a note session, so understanding folds it in on rebuild.
        await db
          .collection('workshopLeads')
          .doc(task.leadId)
          .collection('noteSessions')
          .add({
            text: `[Rhai task: ${task.title}]\n\n${result.slice(0, 12_000)}`,
            source: 'rhai-research',
            label: task.title.slice(0, 80),
            at: now
          });
      } else {
        // Drafts/preps → a generated document in the client profile:
        // readable, refinable, downloadable.
        const docRef = await db
          .collection('workshopLeads')
          .doc(task.leadId)
          .collection('documents')
          .add({
            name: task.title.slice(0, 120),
            origin: 'generated',
            kind: task.skillId ?? 'draft',
            text: result.trim(),
            createdAt: now,
            updatedAt: now
          });
        update.documentId = docRef.id;
      }
    }

    return Response.json({ task: { ...task, ...update } });
  } catch (e) {
    await ref.set(
      { status: 'failed', error: e instanceof Error ? e.message : 'run failed', finishedAt: Date.now() },
      { merge: true }
    );
    return new Response(e instanceof Error ? e.message : 'run failed', { status: 500 });
  }
}
