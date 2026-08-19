// In-person session logistics — types + default checklist templates.
// Client-safe (no server imports): the Sessions panel, the API routes and the
// WhatsApp tools all share these shapes.
//
// A "session" is an on-site engagement day (workshop / recce / build session).
// Divya (EA) coordinates commute + on-site setup off this screen: venue,
// timings, car bookings, what's confirmed with the host. Rhea's prep +
// packing checklists ride on each session, seeded from editable templates.

export type SessionStatus = 'tentative' | 'confirmed' | 'done' | 'cancelled';
export type CarStatus = 'not-needed' | 'needed' | 'booked';

export interface ChecklistItem {
  text: string;
  done: boolean;
  /** true when added ad hoc (not from the template). */
  custom?: boolean;
}

export interface RhaiSession {
  id: string;
  client: string;
  leadId?: string;
  title?: string; // e.g. "AI Workshop — day 1"
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM (IST)
  endTime?: string;
  venue?: string; // office address — used for commute planning
  status: SessionStatus;
  car: { status: CarStatus; notes?: string };
  /** Storage path of the outfit photo (signed URL is minted on read). */
  outfitPath?: string;
  outfitNote?: string;
  /** Free-form: what to pack, printouts, on-site contacts… */
  notes?: string;
  prep: ChecklistItem[];
  packing: ChecklistItem[];
  /** Day-of and after-the-session SOP. Absent on sessions created before this
   *  list existed — always read through `sessionList(s, 'followUp')`. */
  followUp?: ChecklistItem[];
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Default templates — the permanent lists. Stored at
// rhaiConfig/sessionChecklists {prep: string[], packing: string[]} and
// editable from the panel; these are the seed values.
// ---------------------------------------------------------------------------

export const DEFAULT_PREP_TEMPLATE: string[] = [
  'Prep email sent to the team — what the day looks like, prereqs, what to bring',
  'Advance invoice sent (30% standard) — before the session',
  'Their marketing team looped in so they can capture the day (helps us both)',
  'USB-C to HDMI adapter packed',
  'HDMI to USB-C cable packed',
  'Venue has a screen to present on — confirm with host (projectors not preferred)',
  'Table for people to sit around — confirm with host',
  'Everyone bringing laptops + chargers — confirm with host',
  'Participants have a paid Claude subscription, the Claude desktop app, and GitHub connected (for Claude Code)',
  'Reminder message sent 3 days before',
  'Reminder message sent the day before',
  'Data connection / additional discovery checked',
  'Slides for the session ready',
  'Demo dashboard ready (if this tier includes one)',
  'Agenda shared with the team on the morning of the session — so everyone starts on the same page',
  'Lunch sorted — carried with me or ordered ahead so I actually eat'
];

export const DEFAULT_PACKING_TEMPLATE: string[] = [
  'Chargers',
  'Contacts',
  'Glasses',
  'Kit',
  'Night clothes',
  'Comb',
  'Gift for the room — Rhai bag / Hoovu agarbathis'
];

/** The after-the-day SOP: capture, close out, get paid, publish, wind down. */
export const DEFAULT_FOLLOWUP_TEMPLATE: string[] = [
  'Team picture taken — at lunch or at the start of the session',
  'Video testimonial recorded right after the session',
  'Voice testimonials from the participants at the close — heyrhai.com/testimonial',
  'EA / accountants who made the bookings thanked — in person or by email',
  'Closing email sent with all the docs',
  'Final invoice sent after the session',
  'Blog drafted — reflections + the proposal + the slides + the dashboard we built for them',
  'Blog shared with them for approval',
  'Reel cut — the blog material + any footage I took',
  'Reel approved internally, then shared with them for approval',
  'Calendar: disable the demo dashboard 1 week after the session',
  'Courtesy email sent before the demo dashboard is disabled',
  'Calendar: check in on how their progress is going, one month after the session'
];

/** The three lists, in the order they are shown and edited. */
export const CHECKLIST_KEYS = ['prep', 'packing', 'followUp'] as const;
export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

export const CHECKLIST_META: Record<ChecklistKey, { label: string; template: string[] }> = {
  prep: { label: 'Session prep', template: DEFAULT_PREP_TEMPLATE },
  packing: { label: 'Packing', template: DEFAULT_PACKING_TEMPLATE },
  followUp: { label: 'Follow-up', template: DEFAULT_FOLLOWUP_TEMPLATE }
};

/** Reads a checklist off a session, tolerating sessions saved before the list
 *  existed (older docs have no `followUp` field). */
export function sessionList(s: Partial<RhaiSession>, key: ChecklistKey): ChecklistItem[] {
  return s[key] ?? [];
}

export function seedChecklist(template: string[]): ChecklistItem[] {
  return template.map(text => ({ text, done: false }));
}

export const SESSION_STATUS_META: Record<SessionStatus, { label: string; chip: string }> = {
  tentative: { label: 'Tentative', chip: 'bg-ink-50 text-ink-600 border-ink-200' },
  confirmed: { label: 'Confirmed', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  done: { label: 'Done', chip: 'bg-ink-100 text-ink-400 border-ink-200' },
  cancelled: { label: 'Cancelled', chip: 'bg-rose-50 text-rose-500 border-rose-200 line-through' }
};

export const CAR_STATUS_META: Record<CarStatus, { label: string; chip: string; next: CarStatus }> = {
  'not-needed': { label: 'No car needed', chip: 'bg-ink-50 text-ink-500 border-ink-200', next: 'needed' },
  needed: { label: 'Car needed', chip: 'bg-rose-50 text-rose-700 border-rose-200', next: 'booked' },
  booked: { label: 'Car booked', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', next: 'not-needed' }
};
