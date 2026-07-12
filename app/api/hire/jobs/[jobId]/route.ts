import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { loadHirePricing, loadOwnedJob, requireUser } from '@/lib/hire/server';
import { sanitizeQuestions } from '@/lib/hire/questions';
import {
  COL_HIRE_APPS,
  COL_HIRE_JOBS,
  resolvePricing,
  type HireJob,
  type HireQuestion
} from '@/lib/hire/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { user, error } = await requireUser(req);
  if (error) return error;
  const { jobId } = await ctx.params;
  const owned = await loadOwnedJob(user!.uid, jobId);
  if (owned.error) return owned.error;
  const pricing = resolvePricing(await loadHirePricing(), user!.uid);
  return Response.json({ job: owned.job, pricing });
}

// PATCH { title? , questions? , gaps? , status? } — edit the script, publish,
// close. Publishing enforces the job-creation entitlement (free allowance or
// paid). Questions are owner-editable: add / edit / delete / reorder — the
// array IS the order.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { user, error } = await requireUser(req);
  if (error) return error;
  const { jobId } = await ctx.params;
  const owned = await loadOwnedJob(user!.uid, jobId);
  if (owned.error) return owned.error;
  const job = owned.job!;

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    questions?: Partial<HireQuestion>[];
    gaps?: string[];
    status?: HireJob['status'];
  };

  const db = adminDb();
  const update: Record<string, unknown> = { updatedAt: Date.now() };
  if (typeof body.title === 'string' && body.title.trim()) update.title = body.title.trim().slice(0, 140);
  if (Array.isArray(body.questions)) {
    const qs = sanitizeQuestions(body.questions);
    if (qs.length < 3) return new Response('An interview needs at least 3 questions.', { status: 400 });
    update.questions = qs;
  }
  if (Array.isArray(body.gaps)) update.gaps = body.gaps.map(g => String(g).slice(0, 200)).slice(0, 6);

  if (body.status && ['draft', 'open', 'closed'].includes(body.status) && body.status !== job.status) {
    if (body.status === 'open' && !job.paidJob) {
      // Free allowance: this job is free if fewer than `freeJobs` OTHER jobs
      // of this company were created before it.
      const pricing = resolvePricing(await loadHirePricing(), user!.uid);
      const allSnap = await db.collection(COL_HIRE_JOBS).where('companyId', '==', user!.uid).get();
      const olderJobs = allSnap.docs.filter(d => {
        const j = d.data() as HireJob;
        return d.id !== jobId && j.createdAt < job.createdAt;
      }).length;
      if (olderJobs < pricing.freeJobs) {
        update.paidJob = true;
        update.paidVia = 'free';
      } else {
        return new Response(
          `payment_required:${pricing.jobPrice}`, // client shows the pay flow
          { status: 402 }
        );
      }
    }
    update.status = body.status;
  }

  await db.collection(COL_HIRE_JOBS).doc(jobId).set(update, { merge: true });
  return Response.json({ ok: true, job: { ...job, ...update } });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { user, error } = await requireUser(req);
  if (error) return error;
  const { jobId } = await ctx.params;
  const owned = await loadOwnedJob(user!.uid, jobId);
  if (owned.error) return owned.error;

  const db = adminDb();
  // Delete applications for this job (batched).
  const apps = await db.collection(COL_HIRE_APPS).where('jobId', '==', jobId).get();
  const batch = db.batch();
  apps.docs.forEach(d => batch.delete(d.ref));
  batch.delete(db.collection(COL_HIRE_JOBS).doc(jobId));
  await batch.commit();
  return Response.json({ ok: true });
}
