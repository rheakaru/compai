import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/rhai/server';
import { loadOnboardingState } from '@/lib/rhai/onboarding-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Operator-only: the intern's saved orientation state (progress, voice
// takeaways with audio, exercise answers, uploaded docs, pulled transcripts).
export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  return Response.json(await loadOnboardingState());
}
