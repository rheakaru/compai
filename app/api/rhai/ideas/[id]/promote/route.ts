import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  COL_IDEAS,
  anthropic,
  parseJsonLoose,
  requireOperator
} from '@/lib/rhai/server';
import { modelFor } from '@/lib/rhai/models';
import type Anthropic from '@anthropic-ai/sdk';
import type { RhaiIdea, RhaiTask } from '@/lib/rhai/types';
import { DAY_RATE_INR, type WorkshopLead } from '@/lib/leads/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Promote an idea into the pipeline — the anti-silo flow. One click:
//   1. attach to the matching existing lead, or create a new one
//      (ambiguous match → return candidates; UI asks Rhea to pick)
//   2. the idea + Rhai's brainstorm + open questions land on the lead as a
//      note session, so the case builds where the work happens
//   3. Rhai extracts the concrete next moves from its brainstorm and queues
//      them as tasks (visible on the Tasks board AND the lead workspace)
// Nothing to re-type, nothing lost between pages.

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as { leadId?: string };
  const db = adminDb();

  const ideaRef = db.collection(COL_IDEAS).doc(id);
  const ideaSnap = await ideaRef.get();
  if (!ideaSnap.exists) return new Response('not found', { status: 404 });
  const idea = { id, ...(ideaSnap.data() as Omit<RhaiIdea, 'id'>) };

  const leadsSnap = await db.collection('workshopLeads').get();
  const leads = leadsSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<WorkshopLead, 'id'>) }));

  // ---- resolve the target lead ----
  let targetLead: (typeof leads)[number] | null = null;

  if (body.leadId) {
    targetLead = leads.find(l => l.id === body.leadId) ?? null;
    if (!targetLead) return new Response('lead not found', { status: 404 });
  } else {
    // Name-match idea text (+ extra context) against people/companies.
    const hay = ` ${(idea.text + ' ' + (idea.extraContext ?? '')).toLowerCase()} `;
    const matches = leads.filter(l => {
      const tokens = [
        l.person?.trim().toLowerCase(),
        l.person?.trim().toLowerCase().split(' ')[0],
        l.company?.trim().toLowerCase()
      ].filter((t): t is string => !!t && t.length >= 3);
      return tokens.some(t => hay.includes(t));
    });
    const unique = [...new Map(matches.map(l => [l.id, l])).values()];

    if (unique.length === 1) {
      targetLead = unique[0];
    } else if (unique.length > 1) {
      // Ambiguous — let Rhea pick; UI re-calls with leadId.
      return Response.json({
        needsPick: true,
        candidates: unique.slice(0, 4).map(l => ({
          leadId: l.id,
          label: [l.person, l.company].filter(Boolean).join(' · ')
        }))
      });
    }
  }

  const now = Date.now();

  // ---- no match → create a lead, extracting person/company via Haiku ----
  if (!targetLead) {
    let extracted = { person: '', company: '', type: 'company' as const };
    try {
      const msg = await anthropic().messages.create({
        model: modelFor('draft'),
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `From this idea and research, extract the lead's contact. Return ONLY JSON {"person": "<full name or best known>", "company": "<org/company or empty>", "type": "company|org|community"}.\n\nIDEA: ${idea.text}\n${idea.extraContext ? `CONTEXT: ${idea.extraContext}\n` : ''}${idea.enrichment ? `RESEARCH: ${idea.enrichment.slice(0, 2000)}` : ''}`
          }
        ]
      });
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('');
      const p = parseJsonLoose<{ person?: string; company?: string; type?: string }>(text);
      extracted = {
        person: String(p.person ?? '').slice(0, 80),
        company: String(p.company ?? '').slice(0, 80),
        type: (['company', 'org', 'community'].includes(p.type ?? '') ? p.type : 'company') as 'company'
      };
    } catch {
      extracted.person = idea.text.slice(0, 60);
    }

    const newLead = {
      type: extracted.type,
      billing: 'paid',
      person: extracted.person,
      company: extracted.company,
      dateLabel: '',
      stage: 'interested',
      likelihood: 'warm',
      nextSteps: 'Promoted from idea — review Rhai’s brainstorm in notes',
      estimatedDays: 2,
      dayRate: DAY_RATE_INR,
      checklist: {
        engagementEmailSent: false,
        prepReady: false,
        invoiceSent: false,
        closingEmailSent: false,
        paymentReminderSent: false,
        blogPostWritten: false,
        postedSocial: false
      },
      paymentReceived: false,
      jobConnect: false,
      createdAt: now,
      updatedAt: now
    };
    const ref = await db.collection('workshopLeads').add(newLead);
    targetLead = { id: ref.id, ...(newLead as unknown as Omit<WorkshopLead, 'id'>) };
  }

  const leadLabel = [targetLead.person, targetLead.company].filter(Boolean).join(' · ') || 'lead';

  // ---- idea + brainstorm + questions → a note session on the lead ----
  const sessionText = [
    `IDEA: ${idea.text}`,
    idea.extraContext ? `\nContext added: ${idea.extraContext}` : '',
    idea.enrichment ? `\nRHAI'S BRAINSTORM:\n${idea.enrichment}` : '',
    idea.questions?.length ? `\nOPEN QUESTIONS:\n${idea.questions.map(q => `- ${q}`).join('\n')}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  await db.collection('workshopLeads').doc(targetLead.id).collection('noteSessions').add({
    text: sessionText,
    source: 'rhai-research',
    label: `Idea promoted: ${idea.text.slice(0, 60)}`,
    at: now
  });
  await db
    .collection('workshopLeads')
    .doc(targetLead.id)
    .collection('history')
    .add({ field: 'idea-promoted', value: idea.text, previous: null, at: now });

  // ---- extract concrete next moves → queued tasks ----
  let tasksCreated: { id: string; title: string }[] = [];
  if (idea.enrichment) {
    try {
      const msg = await anthropic().messages.create({
        model: modelFor('draft'),
        max_tokens: 600,
        messages: [
          {
            role: 'user',
            content: `From this brainstorm, extract up to 3 concrete tasks an AI cofounder can execute itself (research, drafting, prep — NOT "Rhea should call X"). Return ONLY JSON: {"tasks": [{"title": "<imperative>", "detail": "<what exactly to do>", "research": true|false}]}\n\n${idea.enrichment.slice(0, 3000)}`
          }
        ]
      });
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('');
      const parsed = parseJsonLoose<{ tasks?: { title?: string; detail?: string; research?: boolean }[] }>(text);
      for (const t of (parsed.tasks ?? []).slice(0, 3)) {
        if (!t?.title) continue;
        const task: Omit<RhaiTask, 'id'> = {
          title: String(t.title).slice(0, 200),
          detail: String(t.detail ?? t.title).slice(0, 2000),
          leadId: targetLead.id,
          leadLabel,
          ...(t.research ? { appendToNotes: true } : {}),
          status: 'queued',
          createdAt: now
        };
        const tRef = await db.collection('rhaiTasks').add(task);
        tasksCreated.push({ id: tRef.id, title: task.title });
      }
    } catch {
      // task extraction is best-effort; the note session already landed
    }
  }

  // ---- close out the idea, with the link back ----
  await ideaRef.set(
    { status: 'promoted', leadId: targetLead.id, leadLabel, updatedAt: now },
    { merge: true }
  );

  return Response.json({
    leadId: targetLead.id,
    leadLabel,
    created: !leads.some(l => l.id === targetLead!.id),
    tasksCreated
  });
}
