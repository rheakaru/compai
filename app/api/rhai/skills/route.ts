import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { DOC_SKILLS, requireOperator } from '@/lib/rhai/server';
import { DEFAULT_SKILLS, type RhaiSkill } from '@/lib/rhai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Skills registry — which Claude Code / Claude chat skills Rhai can reach for,
// and the default model per skill. Stored as one doc; seeded with the skills
// Rhea already has. New skills can be added from the UI.

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const snap = await adminDb().doc(DOC_SKILLS).get();
  const skills = snap.exists ? ((snap.data()?.skills ?? []) as RhaiSkill[]) : DEFAULT_SKILLS;
  return Response.json({ skills, seeded: !snap.exists });
}

export async function PUT(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as { skills?: RhaiSkill[] };
  if (!Array.isArray(body.skills)) return new Response('expected { skills: [...] }', { status: 400 });

  const skills = body.skills
    .filter(s => s && typeof s.id === 'string' && typeof s.name === 'string')
    .slice(0, 50)
    .map(s => ({
      id: s.id,
      name: String(s.name).slice(0, 120),
      description: String(s.description ?? '').slice(0, 600),
      model: String(s.model ?? 'claude-sonnet-5'),
      ...(s.stage ? { stage: String(s.stage).slice(0, 40) } : {}),
      enabled: s.enabled !== false
    }));

  await adminDb().doc(DOC_SKILLS).set({ skills, updatedAt: Date.now() });
  return Response.json({ ok: true, skills });
}
