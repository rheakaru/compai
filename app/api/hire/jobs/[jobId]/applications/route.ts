import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { loadOwnedJob, requireUser } from '@/lib/hire/server';
import { COL_HIRE_APPS, type HireApplication } from '@/lib/hire/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Owner's view of a job's applications, ranked by Rhai's fit score. List is
// light (no transcripts); PATCH toggles rejected. Transcript comes from the
// [appId] route.
export async function GET(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { user, error } = await requireUser(req);
  if (error) return error;
  const { jobId } = await ctx.params;
  const owned = await loadOwnedJob(user!.uid, jobId);
  if (owned.error) return owned.error;

  const snap = await adminDb().collection(COL_HIRE_APPS).where('jobId', '==', jobId).get();
  const applications = snap.docs
    .map(d => {
      const a = { id: d.id, ...(d.data() as Omit<HireApplication, 'id'>) } as HireApplication;
      return { ...a, messages: [], messageCount: a.messages.length };
    })
    // Ranked: completed by score desc, then in-progress, newest first within.
    .sort((a, b) => {
      const sa = a.status === 'completed' ? (a.fit?.score ?? -1) : -2;
      const sb = b.status === 'completed' ? (b.fit?.score ?? -1) : -2;
      if (sb !== sa) return sb - sa;
      return b.createdAt - a.createdAt;
    });
  return Response.json({ applications });
}

/** PATCH { applicationId, rejected } — mark/unmark rejected. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { user, error } = await requireUser(req);
  if (error) return error;
  const { jobId } = await ctx.params;
  const owned = await loadOwnedJob(user!.uid, jobId);
  if (owned.error) return owned.error;

  const body = (await req.json().catch(() => ({}))) as { applicationId?: string; rejected?: boolean };
  if (!body.applicationId || typeof body.rejected !== 'boolean')
    return new Response('expected { applicationId, rejected }', { status: 400 });

  const ref = adminDb().collection(COL_HIRE_APPS).doc(body.applicationId);
  const snap = await ref.get();
  if (!snap.exists || (snap.data() as HireApplication).jobId !== jobId)
    return new Response('not found', { status: 404 });
  await ref.set({ rejected: body.rejected }, { merge: true });
  return Response.json({ ok: true });
}
