// Weekly team plans — each Rhai teammate keeps a rough plan for the week
// (typed, voice-noted, or day-wise), editable anytime. Everyone sees everyone's,
// so the team stays synced. Rhai reads the rough text and structures it: pulls
// out days/dates, the clients each item links to, and to-do items.
//
// Isomorphic (client + server) — no server-only imports.

export const COL_PLANS = 'rhaiPlans';

export interface PlanItem {
  text: string;
  date?: string; // 'YYYY-MM-DD'
  time?: string; // free text, e.g. "3pm"
  client?: string; // as written
  leadId?: string; // resolved to a pipeline lead when confident
  leadLabel?: string;
}

export interface PlanDay {
  day: string; // "Monday"
  date?: string; // 'YYYY-MM-DD'
  items: PlanItem[];
}

export interface PlanStructure {
  summary: string;
  days: PlanDay[];
  todos: PlanItem[]; // undated / general action items
  clients: { name: string; leadId?: string; leadLabel?: string }[];
}

export interface WeekPlan {
  id: string; // `${weekStart}_${emailKey}`
  weekStart: string; // 'YYYY-MM-DD' (Monday)
  ownerEmail: string;
  ownerName?: string;
  raw: string; // the rough plan text (voice notes transcribed in)
  structure?: PlanStructure;
  structuredAt?: number;
  createdAt: number;
  updatedAt: number;
}

const IST_OFFSET_MS = 5.5 * 3600_000;

/** Monday (as 'YYYY-MM-DD', IST) of the week containing nowMs. */
export function weekStartISO(nowMs: number): string {
  const ist = new Date(nowMs + IST_OFFSET_MS);
  const dow = ist.getUTCDay(); // 0 Sun … 6 Sat (on the IST-shifted clock)
  const back = (dow + 6) % 7; // days since Monday
  const monday = new Date(ist.getTime() - back * 86400_000);
  return monday.toISOString().slice(0, 10);
}

export function shiftWeekISO(weekStart: string, deltaWeeks: number): string {
  const base = new Date(`${weekStart}T00:00:00Z`).getTime();
  return new Date(base + deltaWeeks * 7 * 86400_000).toISOString().slice(0, 10);
}

/** "7 – 13 Jul 2026" style label for a Monday week-start. */
export function weekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86400_000);
  const opt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' };
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const s = start.toLocaleDateString('en-IN', sameMonth ? { day: 'numeric', timeZone: 'UTC' } : opt);
  const e = end.toLocaleDateString('en-IN', opt);
  return `${s} – ${e} ${end.getUTCFullYear()}`;
}

export function isThisWeek(weekStart: string, nowMs: number): boolean {
  return weekStart === weekStartISO(nowMs);
}

export function emailKey(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

export function planDocId(weekStart: string, email: string): string {
  return `${weekStart}_${emailKey(email)}`;
}

/** First name / handle for display from an email + optional display name. */
export function displayNameFor(email: string, name?: string): string {
  if (name?.trim()) return name.trim();
  const local = email.split('@')[0] ?? email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}
