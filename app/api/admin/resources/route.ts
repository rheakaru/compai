import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/rhai/server';
import { renderedResources } from '@/lib/rhai/resources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Team-only: the learning resources with markdown rendered to HTML.
export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  return Response.json({ resources: renderedResources() });
}
