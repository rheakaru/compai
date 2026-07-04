import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { DOC_SKILLS, requireOperator } from '@/lib/rhai/server';
import { mergeSkills, scanAllSkills } from '@/lib/rhai/skill-scan';
import type { RhaiSkill } from '@/lib/rhai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/rhai/skills/sync — the "Sync from ~/.claude/skills" button.
// Only works when the server has FS access to Rhea's Mac — i.e. when running
// `npm run dev` locally. On the deployed Firebase container there is no
// ~/.claude/skills, so we return a 409 with a message the UI can show.

export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const { skills: discovered, sources } = scanAllSkills();
  if (discovered.length === 0) {
    return Response.json(
      {
        ok: false,
        reason: 'no-fs-access',
        message:
          'No skills found on this server. Sync only works when running the dashboard locally (`npm run dev` on your Mac) — the deployed Firebase container can’t see ~/.claude/skills.'
      },
      { status: 409 }
    );
  }

  const ref = adminDb().doc(DOC_SKILLS);
  const snap = await ref.get();
  const stored = (snap.exists ? ((snap.data()?.skills ?? []) as RhaiSkill[]) : []).filter(
    s => s && typeof s.id === 'string'
  );
  const { merged, added, refreshed } = mergeSkills(stored, discovered);
  await ref.set({ skills: merged, updatedAt: Date.now() });

  return Response.json({
    ok: true,
    scanned: discovered.length,
    added,
    refreshed,
    total: merged.length,
    sources
  });
}
