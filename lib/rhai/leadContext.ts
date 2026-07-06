import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import type { LeadNoteSession, WorkshopLead } from '@/lib/leads/types';
import { formatINR, leadValue } from '@/lib/leads/types';

/**
 * The full working context for one client — lead facts, Rhai's current
 * understanding, and every note session (which meeting said what). This is
 * what rides along with understand/scan/task runs so Rhai always works a
 * client case with everything it knows.
 */
export async function buildLeadContext(
  leadId: string
): Promise<{ lead: WorkshopLead; context: string } | null> {
  const db = adminDb();
  const snap = await db.collection('workshopLeads').doc(leadId).get();
  if (!snap.exists) return null;
  const lead = { id: snap.id, ...(snap.data() as Omit<WorkshopLead, 'id'>) } as WorkshopLead;

  const [notesSnap, docsSnap] = await Promise.all([
    db.collection('workshopLeads').doc(leadId).collection('noteSessions').orderBy('at', 'asc').get(),
    db.collection('workshopLeads').doc(leadId).collection('documents').orderBy('createdAt', 'asc').get()
  ]);
  const sessions = notesSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<LeadNoteSession, 'id'>) }));
  const documents = docsSnap.docs.map(d => d.data() as { name: string; origin: string; text?: string });

  const fmtDate = (t: number) =>
    new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const parts = [
    `CLIENT: ${lead.person || '?'}${lead.company ? ` @ ${lead.company}` : ''}`,
    `Type ${lead.type}/${lead.billing} · stage ${lead.stage} · strength ${lead.likelihood}` +
      (lead.billing === 'paid' ? ` · est. value ${formatINR(leadValue(lead))}` : ''),
    lead.nextSteps ? `Next steps: ${lead.nextSteps}` : '',
    lead.workshopDate ? `Workshop date: ${lead.workshopDate}` : '',
    lead.recce?.date ? `Recce: ${lead.recce.date}` : '',
    lead.understanding
      ? `\nCURRENT UNDERSTANDING (as of ${fmtDate(lead.understanding.updatedAt)}):\n${lead.understanding.summary}\n${lead.understanding.bullets.map(b => `- ${b}`).join('\n')}`
      : '',
    lead.smartNotes?.trim() ? `\nLEGACY RUNNING NOTES:\n${lead.smartNotes.trim().slice(0, 6000)}` : '',
    sessions.length
      ? `\nNOTE SESSIONS (${sessions.length}, oldest first):\n` +
        sessions
          .map(
            s =>
              `--- [${fmtDate(s.at)} · ${s.source}${s.label ? ` · ${s.label}` : ''}] ---\n${s.text.slice(0, 4000)}`
          )
          .join('\n')
      : '\n(no note sessions yet)',
    documents.length
      ? `\nCLIENT DOCUMENTS (${documents.length} — uploaded briefs/files + generated drafts):\n` +
        documents
          .map(d => `--- [${d.origin}] ${d.name} ---\n${(d.text ?? '').slice(0, 3000)}`)
          .join('\n')
      : ''
  ].filter(Boolean);

  return { lead, context: parts.join('\n') };
}
