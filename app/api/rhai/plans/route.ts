import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { COL_PLANS, planDocId, weekStartISO, type WeekPlan } from '@/lib/rhai/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET ?week=YYYY-MM-DD — every teammate's plan for that week (defaults to the
// current week). `me` tells the client which plan it may edit.
export async function GET(req: NextRequest) {
  const { user, error } = await requireOperator(req);
  if (error) return error;
  const week = (req.nextUrl.searchParams.get('week') || weekStartISO(Date.now())).slice(0, 10);

  const snap = await adminDb().collection(COL_PLANS).where('weekStart', '==', week).get();
  const plans = snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<WeekPlan, 'id'>) }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return Response.json({ week, me: user!.email, plans });
}

// PUT { week, raw, ownerName? } — upsert MY plan for a week. A caller can only
// write their own doc (id derived from their email), so nobody edits another
// person's plan.
export async function PUT(req: NextRequest) {
  const { user, error } = await requireOperator(req);
  if (error) return error;
  const email = user!.email;
  if (!email) return new Response('no email on account', { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { week?: string; raw?: string; ownerName?: string };
  const week = (body.week || weekStartISO(Date.now())).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return new Response('bad week', { status: 400 });
  const raw = (body.raw ?? '').slice(0, 20_000);

  const id = planDocId(week, email);
  const ref = adminDb().collection(COL_PLANS).doc(id);
  const now = Date.now();
  const existing = await ref.get();

  const update: Record<string, unknown> = {
    weekStart: week,
    ownerEmail: email,
    ...(body.ownerName ? { ownerName: body.ownerName.slice(0, 80) } : {}),
    raw,
    updatedAt: now,
    ...(existing.exists ? {} : { createdAt: now })
  };
  await ref.set(update, { merge: true });
  return Response.json({ plan: { id, ...(existing.data() as object), ...update } });
}
