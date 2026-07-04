import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { COL_IDEAS, requireOperator } from '@/lib/rhai/server';
import type { RhaiIdea } from '@/lib/rhai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const snap = await adminDb().collection(COL_IDEAS).orderBy('createdAt', 'desc').get();
  const ideas = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RhaiIdea, 'id'>) }));
  return Response.json({ ideas });
}

export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = body.text?.trim();
  if (!text) return new Response('expected { text }', { status: 400 });

  const now = Date.now();
  const idea: Omit<RhaiIdea, 'id'> = { text, status: 'parked', createdAt: now, updatedAt: now };
  const ref = await adminDb().collection(COL_IDEAS).add(idea);
  return Response.json({ idea: { id: ref.id, ...idea } });
}
