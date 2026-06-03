import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import type { LeadInput, WorkshopLead } from '@/lib/leads/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLLECTION = 'workshopLeads';

async function requireOperator(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) return { error: new Response('unauthorized', { status: 401 }) };
  if (!user.operator) return { error: new Response('forbidden — operator only', { status: 403 }) };
  return { user };
}

// Only these fields may be patched from the client; id + timestamps are owned
// by the server.
const MUTABLE_KEYS: (keyof LeadInput)[] = [
  'type',
  'person',
  'company',
  'dateLabel',
  'stage',
  'likelihood',
  'nextSteps',
  'estimatedDays',
  'dayRate',
  'discoveryCallNotesUrl',
  'recce',
  'workshopDate',
  'recceEvent',
  'workshopEvent',
  'checklist',
  'paymentReceived',
  'jobConnect',
  'jobConnectNotes',
  'notes'
];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as LeadInput;
  const update: Record<string, unknown> = { updatedAt: Date.now() };
  for (const k of MUTABLE_KEYS) {
    if (k in body) update[k] = body[k];
  }

  const ref = adminDb().collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return new Response('not found', { status: 404 });

  await ref.set(update, { merge: true });
  const fresh = await ref.get();
  return Response.json({ lead: { id: fresh.id, ...(fresh.data() as Omit<WorkshopLead, 'id'>) } });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;

  await adminDb().collection(COLLECTION).doc(id).delete();
  return Response.json({ ok: true });
}
