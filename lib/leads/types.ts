// Workshop-lead CRM model. Operator-only; persisted in the server-managed
// `workshopLeads` collection and mutated exclusively through /api/leads.

/**
 * The channel a lead came through. Billing is a separate dimension
 * (see `Billing`) because an org session can be either paid or free.
 *  - company   → a company engagement (the core recce + build-day workshop)
 *  - org        → an association / network session (CREDAI, YPO, EO, FICCI FLO…)
 *  - community  → free community sessions ("hang with AI")
 */
export type LeadType = 'company' | 'org' | 'community';

/** Whether money changes hands. Orthogonal to the channel. */
export type Billing = 'paid' | 'free';

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
  | 'gone_cold'
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
  'gone_cold',
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
  gone_cold: 'Gone cold',
  lost: 'Lost'
};

/** Stages that drop a lead out of the active revenue pipeline. */
export const DEAD_STAGES: LeadStage[] = ['gone_cold', 'lost'];

export const TYPE_LABELS: Record<LeadType, string> = {
  company: 'Company',
  org: 'Org',
  community: 'Community'
};

export const BILLING_LABELS: Record<Billing, string> = {
  paid: 'Paid',
  free: 'Free'
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
  billing: Billing;
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

  // ---- Rhai layer ----
  /**
   * Manual sort order for drag-to-reorder (lower = higher in the list). When
   * undefined we fall back to `-createdAt` so brand-new leads surface on top
   * until they're dragged into an explicit position. See `leadOrder`.
   */
  order?: number;
  /**
   * Google-doc-style running notes for this lead — typed live during calls or
   * filled by handwritten-note transcription. This is Rhai's primary input for
   * suggesting next steps and prepping assets.
   */
  smartNotes?: string;
  smartNotesUpdatedAt?: number;
  /**
   * Rhai's living read on this client, rebuilt from all note sessions:
   * a short summary + the top-5 things that matter. Rhea can edit both.
   */
  understanding?: LeadUnderstanding;
  /**
   * Rhai's proactive scan: the next actions worth taking for this client,
   * each executable as a task. Cached — regenerated on demand.
   */
  scan?: LeadScan;

  createdAt: number;
  updatedAt: number;
}

export interface LeadUnderstanding {
  summary: string;
  bullets: string[];
  updatedAt: number;
}

export interface LeadScanAction {
  id: string;
  /** research actions run inline; draft/prep actions queue as Rhai tasks */
  kind: 'research_industry' | 'research_solution' | 'draft_email' | 'draft_proposal' | 'prep_deck' | 'other';
  title: string;
  detail: string;
}

export interface LeadScan {
  actions: LeadScanAction[];
  generatedAt: number;
}

/**
 * A document attached to a lead — either uploaded by Rhea (a brief, an Excel,
 * a PDF the client sent) or generated by Rhai (a proposal, an email). Both
 * live in the client's profile; both feed Rhai's understanding.
 */
export interface LeadDocument {
  id: string;
  name: string;
  origin: 'uploaded' | 'generated';
  /** For uploaded: file kind. For generated: the task/kind that made it. */
  kind: string;
  /** Extracted (uploaded) or authored (generated) text — markdown. */
  text: string;
  /** Original file in Storage, for re-download (uploaded only). */
  storagePath?: string;
  mime?: string;
  sizeBytes?: number;
  /** Prior versions of a generated doc, oldest→newest, before the current text. */
  versions?: { text: string; note: string; at: number }[];
  createdAt: number;
  updatedAt: number;
}

/** One notes session for a lead — a distinct meeting/call/dump, never merged. */
export interface LeadNoteSession {
  id: string;
  text: string;
  source: 'typed' | 'voice' | 'transcribed' | 'rhai-research';
  /** Optional label, e.g. "Recce day 1" or "Call with CFO". */
  label?: string;
  at: number;
}

/**
 * Effective sort key for the pipeline list. Explicit `order` wins; otherwise
 * newest-first via `-createdAt`, which keeps freshly-added leads at the top
 * even after other rows have been dragged into fixed integer positions.
 */
export function leadOrder(l: Pick<WorkshopLead, 'order' | 'createdAt'>): number {
  return typeof l.order === 'number' ? l.order : -l.createdAt;
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
 * Roll paid leads into revenue buckets for the progress bar. Only leads billed
 * as `paid` carry a value (any channel — a paid org session counts too); free
 * sessions are top-of-funnel and never counted. Gone-cold and lost leads are
 * dropped. A lead with payment received always counts as `banked` regardless of
 * its likelihood flag.
 */
export function revenueBuckets(leads: WorkshopLead[]): RevenueBuckets {
  const b: RevenueBuckets = { banked: 0, hot: 0, warm: 0, cold: 0, pipeline: 0 };
  for (const l of leads) {
    if (l.billing !== 'paid' || DEAD_STAGES.includes(l.stage)) continue;
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

/**
 * Map a stored lead onto the current shape. Older rows used a combined `type`
 * (`paid` / `org_session` / `free_session`) and had no `billing` field; split
 * them into channel + billing so the rest of the app sees one consistent model.
 */
export function normalizeLead(
  raw: Omit<WorkshopLead, 'type' | 'billing'> & { type: string; billing?: Billing }
): WorkshopLead {
  let type: LeadType;
  let billing: Billing | undefined = raw.billing;
  switch (raw.type) {
    case 'paid':
      type = 'company';
      billing = billing ?? 'paid';
      break;
    case 'org_session':
      type = 'org';
      billing = billing ?? 'free';
      break;
    case 'free_session':
      type = 'community';
      billing = billing ?? 'free';
      break;
    case 'company':
    case 'org':
    case 'community':
      type = raw.type;
      break;
    default:
      type = 'company';
  }
  return { ...raw, type, billing: billing ?? 'paid' };
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
