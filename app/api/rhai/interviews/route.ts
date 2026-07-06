import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { DEFAULT_INTERVIEWS, type InterviewConfig, type InterviewSession } from '@/lib/rhai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Operator view of the hiring pipeline: all configs (roles) + all sessions
// (candidates), newest first. PATCH toggles a role open/closed.

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const db = adminDb();
  const [configsSnap, sessionsSnap] = await Promise.all([
    db.collection('rhaiInterviews').get(),
    db.collection('rhaiInterviewSessions').orderBy('createdAt', 'desc').limit(100).get()
  ]);

  const stored = configsSnap.docs.map(d => ({ ...(d.data() as InterviewConfig), id: d.id }));
  const storedIds = new Set(stored.map(c => c.id));
  const configs = [...stored, ...DEFAULT_INTERVIEWS.filter(d => !storedIds.has(d.id))];

  const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<InterviewSession, 'id'>) }));
  return Response.json({ configs, sessions });
}

/** PATCH { id, active } — open/close a role. */
export async function PATCH(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { id?: string; active?: boolean };
  if (!body.id || typeof body.active !== 'boolean') return new Response('expected { id, active }', { status: 400 });

  const ref = adminDb().collection('rhaiInterviews').doc(body.id);
  const snap = await ref.get();
  if (!snap.exists) {
    const def = DEFAULT_INTERVIEWS.find(d => d.id === body.id);
    if (!def) return new Response('not found', { status: 404 });
    await ref.set({ ...def, active: body.active, createdAt: Date.now() });
  } else {
    await ref.set({ active: body.active }, { merge: true });
  }
  return Response.json({ ok: true });
}
