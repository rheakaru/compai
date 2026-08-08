import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { loadCompanySettings } from '@/lib/rhai/company';
import { complianceCalendar } from '@/lib/rhai/compliance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Statutory calendar for the company. Items are generated (pure function of
// the FY); only their done-state is stored, keyed by the stable item id.
const COL_COMPLIANCE = 'rhaiCompliance';

function currentFyStart(now = new Date()): number {
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const fyParam = Number(req.nextUrl.searchParams.get('fy'));
  const fyStart = Number.isFinite(fyParam) && fyParam > 2000 ? fyParam : currentFyStart();

  const settings = await loadCompanySettings();
  const items = complianceCalendar(fyStart, { incorporationDate: settings.incorporationDate });

  const stateSnap = await adminDb().collection(COL_COMPLIANCE).get();
  const done = new Map(stateSnap.docs.map(d => [d.id, d.data() as { done?: boolean; note?: string }]));

  return Response.json({
    fyStart,
    items: items.map(i => ({
      ...i,
      done: done.get(i.id)?.done ?? false,
      note: done.get(i.id)?.note ?? ''
    }))
  });
}

export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { id?: string; done?: boolean; note?: string };
  if (!body.id) return new Response('id required', { status: 400 });
  await adminDb()
    .collection(COL_COMPLIANCE)
    .doc(body.id)
    .set(
      {
        ...(typeof body.done === 'boolean' ? { done: body.done } : {}),
        ...(typeof body.note === 'string' ? { note: body.note.slice(0, 500) } : {}),
        updatedAt: Date.now()
      },
      { merge: true }
    );
  return Response.json({ ok: true });
}
