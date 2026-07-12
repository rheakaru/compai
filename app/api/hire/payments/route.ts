import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { loadHirePricing, loadOwnedJob, requireUser } from '@/lib/hire/server';
import { createRazorpayOrder, razorpayConfigured, razorpayKeyId, verifyRazorpaySignature } from '@/lib/hire/payments';
import { COL_HIRE_JOBS, COL_HIRE_PAYMENTS, resolvePricing } from '@/lib/hire/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PayKind = 'job' | 'tier1' | 'tier2';

// GET — is the gateway configured? (UI shows/hides pay buttons)
export async function GET(req: NextRequest) {
  const { error } = await requireUser(req);
  if (error) return error;
  return Response.json({ configured: razorpayConfigured() });
}

// POST { kind, jobId } — create a Razorpay order for an entitlement.
export async function POST(req: NextRequest) {
  const { user, error } = await requireUser(req);
  if (error) return error;
  if (!razorpayConfigured())
    return new Response('Payments are not configured yet — contact rhea@rosebazaar.in to activate.', { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { kind?: PayKind; jobId?: string };
  if (!body.jobId || !body.kind || !['job', 'tier1', 'tier2'].includes(body.kind))
    return new Response('expected { kind, jobId }', { status: 400 });
  const owned = await loadOwnedJob(user!.uid, body.jobId);
  if (owned.error) return owned.error;

  const pricing = resolvePricing(await loadHirePricing(), user!.uid);
  const amountInr = body.kind === 'job' ? pricing.jobPrice : body.kind === 'tier1' ? pricing.tier1Price : pricing.tier2Price;

  const order = await createRazorpayOrder({
    amountInr,
    receipt: `${body.kind}_${body.jobId}`.slice(0, 40),
    notes: { kind: body.kind, jobId: body.jobId, companyId: user!.uid }
  });
  if ('error' in order) return new Response(order.error, { status: 502 });

  await adminDb().collection(COL_HIRE_PAYMENTS).add({
    companyId: user!.uid,
    jobId: body.jobId,
    kind: body.kind,
    amountInr,
    orderId: order.orderId,
    status: 'created',
    createdAt: Date.now()
  });
  return Response.json({ orderId: order.orderId, amountInr, keyId: razorpayKeyId() });
}

// PUT { kind, jobId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
// — verify + grant the entitlement.
export async function PUT(req: NextRequest) {
  const { user, error } = await requireUser(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as {
    kind?: PayKind;
    jobId?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  if (!body.jobId || !body.kind || !body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature)
    return new Response('missing fields', { status: 400 });
  const owned = await loadOwnedJob(user!.uid, body.jobId);
  if (owned.error) return owned.error;

  if (!verifyRazorpaySignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature))
    return new Response('signature verification failed', { status: 400 });

  const db = adminDb();
  const now = Date.now();
  const grant: Record<string, unknown> = { updatedAt: now };
  if (body.kind === 'job') {
    grant.paidJob = true;
    grant.paidVia = 'razorpay';
  } else {
    grant.applicationTier = body.kind; // tier1 | tier2
  }
  await db.collection(COL_HIRE_JOBS).doc(body.jobId).set(grant, { merge: true });

  // Mark the payment record paid (find by orderId).
  const paySnap = await db.collection(COL_HIRE_PAYMENTS).where('orderId', '==', body.razorpay_order_id).limit(1).get();
  if (!paySnap.empty)
    await paySnap.docs[0].ref.set({ status: 'paid', paymentId: body.razorpay_payment_id, paidAt: now }, { merge: true });

  return Response.json({ ok: true });
}
