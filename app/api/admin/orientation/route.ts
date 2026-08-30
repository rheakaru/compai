import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/rhai/server';
import { loadOnboardingState } from '@/lib/rhai/onboarding-state';
import { loadInternConfig, saveInternConfig, type StoredInternConfig } from '@/lib/rhai/intern-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Operator-only: the intern's saved orientation state (progress, voice
// takeaways with audio, exercise answers, uploaded docs, pulled transcripts).
export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const [state, config] = await Promise.all([loadOnboardingState(), loadInternConfig()]);
  return Response.json({ ...state, config });
}

// Edit the intern's details for the offer/joining letters.
export async function PATCH(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { config?: StoredInternConfig };
  if (!body.config || typeof body.config !== 'object') return new Response('bad request', { status: 400 });
  await saveInternConfig(body.config);
  return Response.json({ ok: true, config: await loadInternConfig() });
}
