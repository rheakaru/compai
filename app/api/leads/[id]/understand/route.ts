import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/rhai/server';
import { refreshLeadUnderstanding } from '@/lib/rhai/leadRefresh';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Rebuild Rhai's understanding of a client from all note sessions.
// Summary + top-5 bullets — "so I know we're on the same page."
// Core logic lives in lib/rhai/leadRefresh.ts (shared with Fireflies ingest).

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;

  let understanding;
  try {
    understanding = await refreshLeadUnderstanding(id);
  } catch {
    return new Response('malformed understanding — try again', { status: 502 });
  }
  if (!understanding) return new Response('not found', { status: 404 });
  return Response.json({ understanding });
}
