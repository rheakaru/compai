import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { STAGE_LABELS, leadValue, type LeadStage, type WorkshopLead } from '@/lib/leads/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Team-only: the current ACTIVE clients — the ones we're working with now, not
// the whole noisy leads list. For each: where they stand, the recent calls
// (matched from Fireflies), recent documents, and a link to the full lead page.

// Active = past the initial "interested" stage and not dead/wrapped. Tweak here.
const ACTIVE_STAGES: LeadStage[] = [
  'discovery_call',
  'recce_scheduled',
  'recce_done',
  'workshop_scheduled',
  'invoiced',
  'delivered',
  'paid'
];

function fmtDate(ms?: number): string {
  return ms ? new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const db = adminDb();

  const [leadsSnap, ffSnap] = await Promise.all([
    db.collection('workshopLeads').get(),
    db.collection('firefliesIngested').get()
  ]);

  const leads = leadsSnap.docs
    .map(d => ({ ...(d.data() as Omit<WorkshopLead, 'id'>), id: d.id }))
    .filter(l => ACTIVE_STAGES.includes(l.stage));

  // Group ingested calls by lead.
  const callsByLead: Record<string, { title: string; date: number }[]> = {};
  for (const doc of ffSnap.docs) {
    const r = doc.data() as { leadId?: string; title?: string; callDate?: number; at?: number; status?: string };
    if (r.status !== 'ingested' || !r.leadId) continue;
    (callsByLead[r.leadId] ??= []).push({ title: r.title || 'Call', date: r.callDate || r.at || 0 });
  }
  for (const k of Object.keys(callsByLead)) callsByLead[k].sort((a, b) => b.date - a.date);

  // Recent documents per active lead (a few).
  const clients = await Promise.all(
    leads.map(async l => {
      let docs: { name: string; kind: string; date: number }[] = [];
      try {
        const dsnap = await db.collection('workshopLeads').doc(l.id).collection('documents').orderBy('createdAt', 'desc').limit(4).get();
        docs = dsnap.docs.map(d => {
          const v = d.data() as { name?: string; title?: string; kind?: string; createdAt?: number };
          return { name: v.name || v.title || 'document', kind: v.kind || '', date: v.createdAt || 0 };
        });
      } catch {
        /* no documents subcollection */
      }
      return {
        id: l.id,
        company: l.company,
        person: l.person,
        stage: STAGE_LABELS[l.stage],
        value: leadValue(l),
        nextSteps: l.nextSteps || '',
        smartNotes: (l as WorkshopLead & { smartNotes?: string }).smartNotes || '',
        updatedAt: l.updatedAt || 0,
        calls: (callsByLead[l.id] || []).slice(0, 4).map(c => ({ title: c.title, dateLabel: fmtDate(c.date) })),
        docs: docs.map(d => ({ name: d.name, kind: d.kind, dateLabel: fmtDate(d.date) }))
      };
    })
  );

  // Most recently active first.
  clients.sort((a, b) => b.updatedAt - a.updatedAt);
  return Response.json({ clients });
}
