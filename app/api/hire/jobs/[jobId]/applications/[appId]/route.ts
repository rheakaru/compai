import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { loadOwnedJob, requireUser } from '@/lib/hire/server';
import { COL_HIRE_APPS, type HireApplication } from '@/lib/hire/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Full application (with transcript) — owner only. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ jobId: string; appId: string }> }) {
  const { user, error } = await requireUser(req);
  if (error) return error;
  const { jobId, appId } = await ctx.params;
  const owned = await loadOwnedJob(user!.uid, jobId);
  if (owned.error) return owned.error;

  const snap = await adminDb().collection(COL_HIRE_APPS).doc(appId).get();
  if (!snap.exists) return new Response('not found', { status: 404 });
  const app = { id: snap.id, ...(snap.data() as Omit<HireApplication, 'id'>) } as HireApplication;
  if (app.jobId !== jobId) return new Response('not found', { status: 404 });
  return Response.json({ application: app });
}
