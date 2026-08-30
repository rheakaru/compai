import { NextRequest } from 'next/server';
import { MANDATORY_DOC_IDS, ONBOARDING_TOKEN } from '@/lib/rhai/onboarding';
import { generateLetter, type LetterType } from '@/lib/rhai/hr-letters';
import { loadOnboardingState } from '@/lib/rhai/onboarding-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Returns the offer or joining letter PDF (draft). Token-gated.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get('token') !== ONBOARDING_TOKEN) return new Response('forbidden', { status: 403 });

  // Letters unlock only once the mandatory onboarding documents are on file.
  const state = await loadOnboardingState();
  const missing = MANDATORY_DOC_IDS.filter(id => !state.docs[id]?.url);
  if (missing.length) {
    return new Response(
      `Your offer and joining letters unlock once your documents are uploaded. Still needed: ${missing.join(', ')}.`,
      { status: 403 }
    );
  }

  const type = (p.get('type') === 'joining' ? 'joining' : 'offer') as LetterType;
  const { buffer, filename } = await generateLetter(type);
  return new Response(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${filename}"`,
      'cache-control': 'no-store'
    }
  });
}
