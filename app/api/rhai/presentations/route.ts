import { NextRequest } from 'next/server';
import { requireTeam } from '@/lib/rhai/server';
import { loadPresentations } from '@/lib/rhai/presentations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { error } = await requireTeam(req);
  if (error) return error;
  const leadId = req.nextUrl.searchParams.get('leadId');
  let list = await loadPresentations();
  if (leadId) list = list.filter(p => p.clientLeadId === leadId);
  // Don't ship the storage path to the client.
  return Response.json({ presentations: list.map(({ storagePath, ...p }) => p) });
}
