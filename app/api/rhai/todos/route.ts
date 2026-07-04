import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import type { RhaiTodo } from '@/lib/rhai/types';
import type { WorkshopLead } from '@/lib/leads/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COL_TODOS = 'rhaiTodos';

// Quick to-dos: fast capture in one place. The server resolves WHO each
// to-do is about by matching names against the pipeline — one match links
// automatically (and logs to that lead's history); several matches come back
// as candidates for Rhea to pick; none leaves it general.

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const snap = await adminDb().collection(COL_TODOS).orderBy('createdAt', 'desc').limit(100).get();
  return Response.json({ todos: snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RhaiTodo, 'id'>) })) });
}

export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = body.text?.trim();
  if (!text) return new Response('expected { text }', { status: 400 });

  const db = adminDb();
  const leadsSnap = await db.collection('workshopLeads').get();
  const leads = leadsSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<WorkshopLead, 'id'>) }));

  // Name resolution: does the text mention a lead's person or company?
  const lower = ` ${text.toLowerCase()} `;
  const matches = leads.filter(l => {
    const tokens = [
      l.person?.trim().toLowerCase(),
      l.person?.trim().toLowerCase().split(' ')[0], // first name
      l.company?.trim().toLowerCase()
    ].filter((t): t is string => !!t && t.length >= 3);
    return tokens.some(t => lower.includes(` ${t} `) || lower.includes(` ${t},`) || lower.includes(` ${t}.`) || lower.includes(`${t} `) && lower.trim().startsWith(t));
  });
  // Dedupe candidates by lead id, cap at 4.
  const unique = [...new Map(matches.map(l => [l.id, l])).values()].slice(0, 4);

  const now = Date.now();
  const todo: Omit<RhaiTodo, 'id'> = {
    text,
    done: false,
    createdAt: now,
    updatedAt: now,
    ...(unique.length === 1
      ? {
          leadId: unique[0].id,
          leadLabel: [unique[0].person, unique[0].company].filter(Boolean).join(' · ')
        }
      : unique.length > 1
        ? {
            candidates: unique.map(l => ({
              leadId: l.id,
              label: [l.person, l.company].filter(Boolean).join(' · ')
            }))
          }
        : {})
  };
  const ref = await db.collection(COL_TODOS).add(todo);

  // Single-match link → log on the lead's history as a captured to-do.
  if (todo.leadId) {
    await db
      .collection('workshopLeads')
      .doc(todo.leadId)
      .collection('history')
      .add({ field: 'todo', value: text, previous: null, at: now });
  }

  return Response.json({ todo: { id: ref.id, ...todo } });
}

/** PATCH { id, done? , leadId?/leadLabel? (picking a candidate), delete? } */
export async function PATCH(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    done?: boolean;
    leadId?: string;
    leadLabel?: string;
    delete?: boolean;
  };
  if (!body.id) return new Response('expected { id }', { status: 400 });

  const db = adminDb();
  const ref = db.collection(COL_TODOS).doc(body.id);
  if (body.delete) {
    await ref.delete();
    return Response.json({ ok: true });
  }
  const update: Record<string, unknown> = { updatedAt: Date.now() };
  if (typeof body.done === 'boolean') update.done = body.done;
  if (body.leadId) {
    update.leadId = body.leadId;
    update.leadLabel = body.leadLabel ?? '';
    update.candidates = [];
    const snap = await ref.get();
    const text = (snap.data() as { text?: string })?.text ?? '';
    await db
      .collection('workshopLeads')
      .doc(body.leadId)
      .collection('history')
      .add({ field: 'todo', value: text, previous: null, at: Date.now() });
  }
  await ref.set(update, { merge: true });
  return Response.json({ ok: true });
}
