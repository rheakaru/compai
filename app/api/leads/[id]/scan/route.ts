import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/rhai/server';
import { refreshLeadScan } from '@/lib/rhai/leadRefresh';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// The client scan — Rhai as proactive business partner on this case.
// Reads the full client context and proposes executable next actions
// (industry research, solution research for client-requested tools, drafts,
// deck prep). Cached on the lead; regenerated on demand.
// Core logic lives in lib/rhai/leadRefresh.ts (shared with Fireflies ingest).

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const { id } = await ctx.params;

  let scan;
  try {
    scan = await refreshLeadScan(id);
  } catch {
    return new Response('malformed scan — try again', { status: 502 });
  }
  if (!scan) return new Response('not found', { status: 404 });
  return Response.json({ scan });
}
