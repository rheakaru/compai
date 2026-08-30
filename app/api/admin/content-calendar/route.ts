import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/rhai/server';
import { loadContentCalendar, saveContentCalendar, type ContentItem } from '@/lib/rhai/content-calendar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  return Response.json(await loadContentCalendar());
}

export async function PUT(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { items?: ContentItem[] };
  if (!Array.isArray(body.items)) return new Response('bad request', { status: 400 });
  await saveContentCalendar(body.items);
  return Response.json({ ok: true });
}
