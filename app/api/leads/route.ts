import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import {
  DAY_RATE_INR,
  EMPTY_CHECKLIST,
  type LeadInput,
  type WorkshopLead
} from '@/lib/leads/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLLECTION = 'workshopLeads';

async function requireOperator(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) return { error: new Response('unauthorized', { status: 401 }) };
  if (!user.operator) return { error: new Response('forbidden — operator only', { status: 403 }) };
  return { user };
}

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const snap = await adminDb().collection(COLLECTION).orderBy('createdAt', 'desc').get();
  const leads = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<WorkshopLead, 'id'>) }));
  return Response.json({ leads });
}

export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as LeadInput;
  const now = Date.now();

  const lead: Omit<WorkshopLead, 'id'> = {
    type: body.type ?? 'company',
    billing: body.billing ?? 'paid',
    person: body.person?.trim() ?? '',
    company: body.company?.trim() ?? '',
    dateLabel: body.dateLabel?.trim() ?? '',
    stage: body.stage ?? 'interested',
    likelihood: body.likelihood ?? 'warm',
    nextSteps: body.nextSteps?.trim() ?? '',
    estimatedDays: typeof body.estimatedDays === 'number' ? body.estimatedDays : 2,
    dayRate: typeof body.dayRate === 'number' ? body.dayRate : DAY_RATE_INR,
    discoveryCallNotesUrl: body.discoveryCallNotesUrl,
    recce: body.recce,
    workshopDate: body.workshopDate,
    checklist: { ...EMPTY_CHECKLIST, ...(body.checklist ?? {}) },
    paymentReceived: body.paymentReceived ?? false,
    jobConnect: body.jobConnect ?? false,
    jobConnectNotes: body.jobConnectNotes,
    notes: body.notes,
    createdAt: now,
    updatedAt: now
  };

  const ref = await adminDb().collection(COLLECTION).add(lead);
  return Response.json({ lead: { id: ref.id, ...lead } });
}
