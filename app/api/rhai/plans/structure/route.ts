import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { buildRhaiSystemPrompt, loadContextSections, parseJsonLoose, requireOperator, runRhaiWithContext } from '@/lib/rhai/server';
import { modelFor } from '@/lib/rhai/models';
import type { WorkshopLead } from '@/lib/leads/types';
import { COL_PLANS } from '../route';
import { planDocId, weekLabel, weekStartISO, type PlanItem, type PlanStructure, type WeekPlan } from '@/lib/rhai/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Rhai reads a rough week plan and structures it: days + dates, the pipeline
// lead each item links to (resolved against the real lead roster), and to-do
// items. Structures the CALLER's own plan only.
export async function POST(req: NextRequest) {
  const { user, error } = await requireOperator(req);
  if (error) return error;
  const email = user!.email;
  if (!email) return new Response('no email on account', { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { week?: string };
  const week = (body.week || weekStartISO(Date.now())).slice(0, 10);
  const db = adminDb();
  const ref = db.collection(COL_PLANS).doc(planDocId(week, email));
  const snap = await ref.get();
  if (!snap.exists) return new Response('no plan for this week yet', { status: 404 });
  const plan = { id: snap.id, ...(snap.data() as Omit<WeekPlan, 'id'>) };
  if (!plan.raw.trim()) return new Response('plan is empty', { status: 400 });

  const [leadsSnap, sections] = await Promise.all([
    db.collection('workshopLeads').orderBy('createdAt', 'desc').get(),
    loadContextSections()
  ]);
  const leads = leadsSnap.docs.map(d => {
    const l = d.data() as Omit<WorkshopLead, 'id'>;
    return { id: d.id, label: [l.person, l.company].filter(Boolean).join(' / ') || d.id };
  });
  const leadById = new Map(leads.map(l => [l.id, l.label]));
  const roster = leads.map(l => `${l.id} :: ${l.label}`).join('\n');

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const raw = await runRhaiWithContext({
    model: modelFor('suggest'),
    maxTokens: 2500,
    system: buildRhaiSystemPrompt(sections),
    userContent: [
      `Today is ${today}. Structure this teammate's rough plan for the week of ${weekLabel(week)} (Monday ${week}).`,
      ``,
      `THEIR ROUGH PLAN:\n${plan.raw.slice(0, 16_000)}`,
      ``,
      `PIPELINE LEADS (id :: name/company) — resolve any client mention to one of these ids when you're confident (fuzzy match on name/company/short forms like "SRC"). Omit leadId if unsure:`,
      roster || '(no leads yet)',
      ``,
      `Extract structure. Resolve relative dates ("tue", "next mon") to 'YYYY-MM-DD' within/near this week. Return ONLY JSON:`,
      `{"summary":"<1-2 sentence read of their week>",`,
      ` "days":[{"day":"Monday","date":"YYYY-MM-DD","items":[{"text":"…","time":"<if given>","client":"<as written, if any>","leadId":"<pipeline id if confident>"}]}],`,
      ` "todos":[{"text":"<undated action item>","client":"<if any>","leadId":"<if confident>","date":"<YYYY-MM-DD if implied>"}],`,
      ` "clients":[{"name":"<client mentioned>","leadId":"<id if resolved>"}]}`,
      `Only include days that actually have items. Keep item text faithful and short.`
    ].join('\n')
  });

  let parsed: Partial<PlanStructure>;
  try {
    parsed = parseJsonLoose(raw);
  } catch {
    return new Response('Rhai returned malformed structure — try again', { status: 502 });
  }

  // Validate + enrich lead links from the real roster.
  const fixItem = (it: PlanItem): PlanItem => {
    const leadId = it.leadId && leadById.has(it.leadId) ? it.leadId : undefined;
    return {
      text: String(it.text ?? '').slice(0, 300),
      ...(it.date && /^\d{4}-\d{2}-\d{2}$/.test(it.date) ? { date: it.date } : {}),
      ...(it.time ? { time: String(it.time).slice(0, 40) } : {}),
      ...(it.client ? { client: String(it.client).slice(0, 80) } : {}),
      ...(leadId ? { leadId, leadLabel: leadById.get(leadId) } : {})
    };
  };

  const structure: PlanStructure = {
    summary: String(parsed.summary ?? '').slice(0, 600),
    days: (parsed.days ?? [])
      .filter(d => d && Array.isArray(d.items) && d.items.length)
      .slice(0, 7)
      .map(d => ({
        day: String(d.day ?? '').slice(0, 20),
        ...(d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? { date: d.date } : {}),
        items: d.items.slice(0, 20).map(fixItem).filter(i => i.text)
      })),
    todos: (parsed.todos ?? []).slice(0, 40).map(fixItem).filter(i => i.text),
    clients: (parsed.clients ?? [])
      .slice(0, 40)
      .map(c => {
        const leadId = c.leadId && leadById.has(c.leadId) ? c.leadId : undefined;
        return { name: String(c.name ?? '').slice(0, 80), ...(leadId ? { leadId, leadLabel: leadById.get(leadId) } : {}) };
      })
      .filter(c => c.name)
  };

  await ref.set({ structure, structuredAt: Date.now() }, { merge: true });
  return Response.json({ structure });
}
