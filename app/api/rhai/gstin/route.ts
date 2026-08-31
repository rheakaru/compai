import { NextRequest } from 'next/server';
import { requireFinance } from '@/lib/rhai/server';
import { lookupGstin } from '@/lib/rhai/gstin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { error } = await requireFinance(req);
  if (error) return error;
  const gstin = req.nextUrl.searchParams.get('gstin') || '';
  if (!gstin) return new Response('gstin required', { status: 400 });
  return Response.json(await lookupGstin(gstin));
}
