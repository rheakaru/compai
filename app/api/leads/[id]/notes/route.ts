import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import type { LeadNoteSession } from '@/lib/leads/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Note sessions — each call/meeting/dump is its own timestamped doc, never
// merged into one blob. "Later I'll know which meeting the information came
// from." Understanding is rebuilt separately (POST /understand).

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;
  const snap = await adminDb()
    .collection('workshopLeads')
    .doc(id)
    .collection('noteSessions')
    .orderBy('at', 'desc')
    .get();
  return Response.json({
    sessions: snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<LeadNoteSession, 'id'>) }))
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    source?: LeadNoteSession['source'];
    label?: string;
  };
  const text = body.text?.trim();
  if (!text) return new Response('expected { text }', { status: 400 });

  const leadRef = adminDb().collection('workshopLeads').doc(id);
  if (!(await leadRef.get()).exists) return new Response('not found', { status: 404 });

  const session: Omit<LeadNoteSession, 'id'> = {
    text,
    source: body.source ?? 'typed',
    ...(body.label?.trim() ? { label: body.label.trim() } : {}),
    at: Date.now()
  };
  const ref = await leadRef.collection('noteSessions').add(session);
  // Touch the lead so it re-ranks to the top of the recency-sorted pipeline.
  await leadRef.update({ updatedAt: Date.now() });
  return Response.json({ session: { id: ref.id, ...session } });
}
