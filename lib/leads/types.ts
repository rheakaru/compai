// Workshop-lead CRM model. Operator-only; persisted in the server-managed
// `workshopLeads` collection and mutated exclusively through /api/leads.

/** What kind of pipeline this row belongs to. */
export type LeadType = 'paid' | 'org_session' | 'free_session';

/**
 * Lead likelihood — drives the colour of the revenue progress bar so the
 * operator can read pipeline strength at a glance. `banked` is derived, not
 * set by hand (it means payment has actually landed).
 */
export type Likelihood = 'hot' | 'warm' | 'cold';

/**
 * Stages map to the real engagement journey described on the sessions page:
 * interest → discovery call → recce day(s) → build day → invoice → delivery →
 * payment → post-event wrap-up. `org_session` / `free_session` rows reuse the
 * early stages loosely (they are top-of-funnel, not directly billed).
 */
export type LeadStage =
  | 'interested'
  | 'discovery_call'
  | 'recce_scheduled'
  | 'recce_done'
  | 'workshop_scheduled'
  | 'invoiced'
  | 'delivered'
  | 'paid'
  | 'closed'
  | 'lost';

export const STAGE_ORDER: LeadStage[] = [
  'interested',
  'discovery_call',
  'recce_scheduled',
  'recce_done',
  'workshop_scheduled',
  'invoiced',
  'delivered',
  'paid',
  'closed',
  'lost'
];

export const STAGE_LABELS: Record<LeadStage, string> = {
  interested: 'Interested',
  discovery_call: 'Discovery call',
  recce_scheduled: 'Recce scheduled',
  recce_done: 'Recce done',
  workshop_scheduled: 'Workshop scheduled',
  invoiced: 'Invoiced',
  delivered: 'Delivered',
  paid: 'Paid',
  closed: 'Closed / wrapped',
  lost: 'Lost'
};

export const TYPE_LABELS: Record<LeadType, string> = {
  paid: 'Paid',
  org_session: 'Org session',
  free_session: 'Free session'
};

export const LIKELIHOOD_LABELS: Record<Likelihood, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold'
};

/** Recce-day logistics that get locked in after the discovery call. */
export interface RecceDetails {
  date?: string; // free text, e.g. "Jun 14" or "wk of Jun 16"
  time?: string;
  location?: string;
  notesUrl?: string;
}

/** A Google Calendar event the dashboard created for this lead. */
export interface CalEventRef {
  id: string;
  htmlLink: string;
  start: string; // ISO datetime
}

/**
 * The post-discovery journey checklist. Each flag corresponds to one of the
 * concrete steps the operator runs for every engagement.
 */
export interface JourneyChecklist {
  engagementEmailSent: boolean; // sent before the recce trip
  prepReady: boolean; // presentation / demo app ready for the build day
  invoiceSent: boolean; // shared before the session so they can pay same-day
  closingEmailSent: boolean; // next steps + resources + demo-buildout offer
  paymentReminderSent: boolean; // only if payment is late
  blogPostWritten: boolean; // write-up on personal site
  postedSocial: boolean; // twitter + instagram with photos
}

export const EMPTY_CHECKLIST: JourneyChecklist = {
  engagementEmailSent: false,
  prepReady: false,
  invoiceSent: false,
  closingEmailSent: false,
  paymentReminderSent: false,
  blogPostWritten: false,
  postedSocial: false
};

export interface WorkshopLead {
  id: string;
  type: LeadType;
  person: string;
  company: string;
  /** Date or tentative range as free text — exact dates aren't known early. */
  dateLabel: string;
  stage: LeadStage;
  likelihood: Likelihood;
  nextSteps: string;

  // ---- budgeting ----
  /** Days in the engagement (recce + build). Drives the revenue estimate. */
  estimatedDays: number;
  /** Per-day rate in INR. Defaults to the standard ₹1 lakh. */
  dayRate: number;

  // ---- journey artifacts ----
  discoveryCallNotesUrl?: string;
  recce?: RecceDetails;
  workshopDate?: string;
  /** Google Calendar events pushed from the dashboard, if scheduled. */
  recceEvent?: CalEventRef;
  workshopEvent?: CalEventRef;
  checklist: JourneyChecklist;
  /** Set true once payment has actually landed — counts as banked revenue. */
  paymentReceived: boolean;

  // ---- job-connect goal (SF / Anthropic / Sarvam etc.) ----
  jobConnect: boolean;
  jobConnectNotes?: string;

  notes?: string;
  createdAt: number;
  updatedAt: number;
}

/** Fields a client may send when creating/patching. Server owns id + timestamps. */
export type LeadInput = Partial<Omit<WorkshopLead, 'id' | 'createdAt' | 'updatedAt'>>;

// ---------------------------------------------------------------------------
// Targets & revenue math
// ---------------------------------------------------------------------------

export const DAY_RATE_INR = 100_000; // ₹1 lakh / day — the standard rate
export const JUNE_TARGET_INR = 1_500_000; // ₹15 lakh — June revenue target

/** Estimated rupee value of a single lead. */
export function leadValue(l: Pick<WorkshopLead, 'estimatedDays' | 'dayRate'>): number {
  return Math.max(0, (l.estimatedDays || 0) * (l.dayRate || DAY_RATE_INR));
}

export interface RevenueBuckets {
  banked: number; // payment received
  hot: number;
  warm: number;
  cold: number;
  /** banked + hot + warm + cold — full weighted pipeline. */
  pipeline: number;
}

/**
 * Roll paid-type leads into revenue buckets for the progress bar. Only `paid`
 * leads carry a billable value; org/free sessions are top-of-funnel and never
 * counted here. Lost leads are dropped. A lead with payment received always
 * counts as `banked` regardless of its likelihood flag.
 */
export function revenueBuckets(leads: WorkshopLead[]): RevenueBuckets {
  const b: RevenueBuckets = { banked: 0, hot: 0, warm: 0, cold: 0, pipeline: 0 };
  for (const l of leads) {
    if (l.type !== 'paid' || l.stage === 'lost') continue;
    const v = leadValue(l);
    if (l.paymentReceived || l.stage === 'paid' || l.stage === 'closed') {
      b.banked += v;
    } else {
      b[l.likelihood] += v;
    }
  }
  b.pipeline = b.banked + b.hot + b.warm + b.cold;
  return b;
}

export function formatINR(n: number): string {
  // Indian grouping (lakh/crore) + ₹ prefix, no decimals.
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

/** Short lakh form, e.g. 1_500_000 → "₹15L". */
export function formatLakh(n: number): string {
  const l = n / 100_000;
  const s = Number.isInteger(l) ? String(l) : l.toFixed(1);
  return `₹${s}L`;
}
