// Rhai Interviews — the generalized, sellable version of the interview tool.
// Any company signs in, builds a company profile + job interviews with Rhai,
// shares an application link, and reviews Rhai-ranked applications.
//
// Isomorphic types (client + server). Collection names live here too so route
// files never export non-handler values.

export const COL_HIRE_COMPANIES = 'hireCompanies'; // doc id == owner uid (one company per account, v1)
export const COL_HIRE_JOBS = 'hireJobs';
export const COL_HIRE_APPS = 'hireApplications';
export const COL_HIRE_PAYMENTS = 'hirePayments';
export const DOC_HIRE_PRICING = 'rhaiConfig/hirePricing';

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------

export interface HireCompany {
  id: string; // == owner uid
  ownerEmail: string;
  name: string;
  website?: string;
  /** The founder's rough text/voice description — kept verbatim. */
  about: string;
  /** Rhai-structured brief used inside interviews (public-safe). */
  profile?: string;
  /** What Rhai still wants to know about the company. */
  gaps?: string[];
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Jobs + the collaborative question script
// ---------------------------------------------------------------------------

export type HireQuestionKind = 'logistics' | 'experience' | 'behavioral' | 'role' | 'culture' | 'closing';

export const QUESTION_KIND_LABELS: Record<HireQuestionKind, string> = {
  logistics: 'Logistics',
  experience: 'Experience',
  behavioral: 'Behavioral',
  role: 'Role-specific',
  culture: 'Culture & motivation',
  closing: 'Closing'
};

export interface HireQuestion {
  id: string;
  text: string;
  /** What this question probes — shown to the owner, never the candidate. */
  purpose?: string;
  kind: HireQuestionKind;
}

export type HireJobStatus = 'draft' | 'open' | 'closed';

export interface HireJob {
  id: string;
  companyId: string;
  title: string;
  /** Job description text (pasted or extracted from an upload). */
  jd: string;
  questions: HireQuestion[];
  /** Rhai's open questions for the OWNER (info it's missing). */
  gaps?: string[];
  status: HireJobStatus;
  /** Job-creation entitlement: within free allowance, paid, or manually granted. */
  paidJob: boolean;
  paidVia?: 'free' | 'razorpay' | 'manual';
  /** Application-volume entitlement. free→10, tier1→50, tier2→unlimited. */
  applicationTier: 'free' | 'tier1' | 'tier2';
  /** Applications STARTED (capacity is consumed at start to prevent races). */
  applicationsCount: number;
  /** Collaboration chat with Rhai on the question script. */
  chat?: { role: 'user' | 'rhai'; text: string; at: number }[];
  createdAt: number;
  updatedAt: number;
}

export const TIER_LIMITS: Record<HireJob['applicationTier'], number> = {
  free: 10,
  tier1: 50,
  tier2: Number.MAX_SAFE_INTEGER
};

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export interface HireCandidate {
  name: string;
  email: string;
  phone: string;
  resumeUrl?: string;
}

export interface HireFit {
  score: number; // 0–100
  verdict: 'strong' | 'possible' | 'weak';
  summary: string;
  strengths: string[];
  concerns: string[];
}

export interface HireApplication {
  id: string;
  jobId: string;
  companyId: string;
  candidate: HireCandidate;
  messages: { role: 'rhai' | 'candidate'; text: string; at: number }[];
  status: 'in_progress' | 'completed';
  fit?: HireFit;
  rejected?: boolean;
  createdAt: number;
  completedAt?: number;
}

export const FIT_META: Record<HireFit['verdict'], { label: string; chip: string }> = {
  strong: { label: 'Strong fit', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  possible: { label: 'Possible', chip: 'bg-amber-50 text-amber-800 border-amber-200' },
  weak: { label: 'Weak fit', chip: 'bg-rose-50 text-rose-700 border-rose-200' }
};

// ---------------------------------------------------------------------------
// Pricing (INR) — operator-editable globally and per company.
// ---------------------------------------------------------------------------

export interface HirePricingBase {
  jobPrice: number; // ₹ per job beyond the free allowance
  tier1Price: number; // unlock 10→50 applications on a job
  tier2Price: number; // unlock 50+ (unlimited) applications on a job
  freeJobs: number; // free jobs per company
  freeApplications: number; // free applications per job
}

export interface HirePricing extends HirePricingBase {
  /** Per-company overrides (differential pricing), keyed by companyId. */
  overrides?: Record<string, Partial<HirePricingBase>>;
}

export const DEFAULT_HIRE_PRICING: HirePricing = {
  jobPrice: 1000,
  tier1Price: 3000,
  tier2Price: 5000,
  freeJobs: 1,
  freeApplications: 10
};

export function resolvePricing(p: HirePricing, companyId: string): HirePricingBase {
  const o = p.overrides?.[companyId] ?? {};
  return {
    jobPrice: o.jobPrice ?? p.jobPrice,
    tier1Price: o.tier1Price ?? p.tier1Price,
    tier2Price: o.tier2Price ?? p.tier2Price,
    freeJobs: o.freeJobs ?? p.freeJobs,
    freeApplications: o.freeApplications ?? p.freeApplications
  };
}

/** Effective application cap for a job given its tier + pricing. */
export function applicationCap(job: Pick<HireJob, 'applicationTier'>, pricing: HirePricingBase): number {
  if (job.applicationTier === 'tier2') return Number.MAX_SAFE_INTEGER;
  if (job.applicationTier === 'tier1') return 50;
  return pricing.freeApplications;
}
