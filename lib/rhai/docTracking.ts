// Deal-velocity document tracking — types + pure helpers. Client-safe (no
// server-only imports) so the RhaiDocs panel and /api/rhai/docs share one
// source of truth.
//
// Nothing here is stored: milestone dates are ALWAYS derived on read from the
// lead's documents (docDate ?? createdAt), noteSessions, stage history and the
// invoice tracker, so the timeline can never drift out of sync with reality.

import type { LeadStage } from '@/lib/leads/types';

/** Doc types the tracker cares about. Stored as LeadDocument.kind. */
export type TrackedDocKind = 'nda' | 'nda-signed' | 'proposal' | 'other';

export const TRACKED_DOC_KINDS: TrackedDocKind[] = ['nda', 'nda-signed', 'proposal', 'other'];

export const DOC_KIND_LABELS: Record<TrackedDocKind, string> = {
  nda: 'NDA sent',
  'nda-signed': 'NDA signed (received)',
  proposal: 'Proposal sent',
  other: 'Other'
};

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export type MilestoneKey = 'firstCall' | 'ndaSent' | 'ndaSigned' | 'proposalSent' | 'invoiceSent';

export const MILESTONE_ORDER: MilestoneKey[] = [
  'firstCall',
  'ndaSent',
  'ndaSigned',
  'proposalSent',
  'invoiceSent'
];

export const MILESTONE_LABELS: Record<MilestoneKey, string> = {
  firstCall: 'First call',
  ndaSent: 'NDA sent',
  ndaSigned: 'NDA signed',
  proposalSent: 'Proposal sent',
  invoiceSent: 'Invoice sent'
};

/** Short names for delta chips, e.g. "call → NDA: 3d". */
export const MILESTONE_SHORT: Record<MilestoneKey, string> = {
  firstCall: 'call',
  ndaSent: 'NDA',
  ndaSigned: 'signed',
  proposalSent: 'proposal',
  invoiceSent: 'invoice'
};

/** Milestone dates (ms epoch); absent = not reached / no dated evidence. */
export type MilestoneSet = Partial<Record<MilestoneKey, number>>;

/** One tracked doc, as returned in the GET aggregation (no text body). */
export interface TrackedDoc {
  id: string;
  name: string;
  kind: string;
  origin: 'uploaded' | 'generated';
  at: number; // docDate ?? createdAt
  /** The explicit on-document date, if one is set (null = falling back to upload time). */
  docDate?: number | null;
}

/** One row of the deal timeline table. */
export interface DealRow {
  leadId: string;
  person: string;
  company: string;
  stage: LeadStage;
  milestones: MilestoneSet;
  /**
   * checklist.invoiceSent is true but no dated invoice/history evidence was
   * found — shown as "sent (no date)" and excluded from deltas/medians.
   */
  invoiceSentNoDate?: boolean;
  documents: TrackedDoc[];
}

export interface DocsTrackingResponse {
  rows: DealRow[];
  generatedAt: number;
}

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export function daysBetween(fromMs: number, toMs: number): number {
  return Math.round((toMs - fromMs) / DAY_MS);
}

/** Day-deltas between consecutive PRESENT milestones, in funnel order. */
export interface MilestoneDelta {
  from: MilestoneKey;
  to: MilestoneKey;
  days: number;
}

export function milestoneDeltas(m: MilestoneSet): MilestoneDelta[] {
  const present = MILESTONE_ORDER.filter(k => typeof m[k] === 'number');
  const out: MilestoneDelta[] = [];
  for (let i = 1; i < present.length; i++) {
    out.push({
      from: present[i - 1],
      to: present[i],
      days: daysBetween(m[present[i - 1]]!, m[present[i]]!)
    });
  }
  return out;
}

// A lead that has left the active pipeline can't be "stalled".
const STALL_EXEMPT_STAGES: LeadStage[] = ['paid', 'closed', 'gone_cold', 'lost'];

export const STALL_DAYS = 14;

export interface StallInfo {
  /** The next milestone that hasn't happened yet. */
  next: MilestoneKey;
  /** Days since the last milestone that DID happen. */
  daysSince: number;
}

/**
 * A deal is stalled when its next milestone is missing and the last one it
 * reached is older than STALL_DAYS. Returns null when healthy, complete, or
 * out of the pipeline.
 */
export function stallInfo(row: Pick<DealRow, 'stage' | 'milestones'>, nowMs: number): StallInfo | null {
  if (STALL_EXEMPT_STAGES.includes(row.stage)) return null;
  let lastIdx = -1;
  for (let i = 0; i < MILESTONE_ORDER.length; i++) {
    if (typeof row.milestones[MILESTONE_ORDER[i]] === 'number') lastIdx = i;
  }
  if (lastIdx === -1) return null; // nothing dated yet — nothing to measure from
  const next = MILESTONE_ORDER.slice(lastIdx + 1).find(k => typeof row.milestones[k] !== 'number');
  if (!next) return null; // funnel complete
  const daysSince = daysBetween(row.milestones[MILESTONE_ORDER[lastIdx]]!, nowMs);
  return daysSince > STALL_DAYS ? { next, daysSince } : null;
}

// ---------------------------------------------------------------------------
// Velocity summary — medians across leads that have both endpoints.
// ---------------------------------------------------------------------------

export function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface VelocitySummary {
  callToNda: number | null; // first call → NDA sent
  ndaToProposal: number | null; // NDA (signed, else sent) → proposal sent
  proposalToInvoice: number | null; // proposal sent → invoice sent
  counts: { callToNda: number; ndaToProposal: number; proposalToInvoice: number };
}

export function velocitySummary(rows: Pick<DealRow, 'milestones'>[]): VelocitySummary {
  const callToNda: number[] = [];
  const ndaToProposal: number[] = [];
  const proposalToInvoice: number[] = [];
  for (const { milestones: m } of rows) {
    if (m.firstCall != null && m.ndaSent != null) callToNda.push(daysBetween(m.firstCall, m.ndaSent));
    const nda = m.ndaSigned ?? m.ndaSent;
    if (nda != null && m.proposalSent != null) ndaToProposal.push(daysBetween(nda, m.proposalSent));
    if (m.proposalSent != null && m.invoiceSent != null)
      proposalToInvoice.push(daysBetween(m.proposalSent, m.invoiceSent));
  }
  return {
    callToNda: median(callToNda),
    ndaToProposal: median(ndaToProposal),
    proposalToInvoice: median(proposalToInvoice),
    counts: {
      callToNda: callToNda.length,
      ndaToProposal: ndaToProposal.length,
      proposalToInvoice: proposalToInvoice.length
    }
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

/** 'YYYY-MM-DD' → ms at UTC noon (avoids off-by-one across timezones). */
export function isoToMs(iso: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const t = Date.parse(`${iso}T12:00:00Z`);
  return Number.isNaN(t) ? undefined : t;
}
