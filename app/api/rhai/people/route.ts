import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { COL_PEOPLE, requireOperator } from '@/lib/rhai/server';
import type { RhaiPerson } from '@/lib/rhai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const snap = await adminDb().collection(COL_PEOPLE).get();
  const people = snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<RhaiPerson, 'id'>) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return Response.json({ people });
}

export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as Partial<RhaiPerson>;
  const name = body.name?.trim();
  if (!name) return new Response('expected { name }', { status: 400 });

  const now = Date.now();
  const doc: Omit<RhaiPerson, 'id'> = {
    name,
    tier: body.tier ?? 'community',
    ...(body.headline ? { headline: body.headline } : {}),
    ...(body.company ? { company: body.company } : {}),
    ...(body.notes ? { notes: body.notes } : {}),
    status: 'stub',
    createdAt: now,
    updatedAt: now
  };
  const ref = await adminDb().collection(COL_PEOPLE).add(doc);
  return Response.json({ person: { id: ref.id, ...doc } });
}
