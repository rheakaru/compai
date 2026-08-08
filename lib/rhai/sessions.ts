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
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Default templates — the permanent lists. Stored at
// rhaiConfig/sessionChecklists {prep: string[], packing: string[]} and
// editable from the panel; these are the seed values.
// ---------------------------------------------------------------------------

export const DEFAULT_PREP_TEMPLATE: string[] = [
  'USB-C to HDMI adapter packed',
  'HDMI to USB-C cable packed',
  'Venue has a screen to present on — confirm with host (projectors not preferred)',
  'Table for people to sit around — confirm with host',
  'Everyone bringing laptops + chargers — confirm with host',
  'Participants have a paid Claude subscription, the Claude desktop app, and GitHub connected (for Claude Code)',
  'Reminder message sent 3 days before',
  'Reminder message sent the day before',
  'Data connection / additional discovery checked',
  'Slides for the session ready'
];

export const DEFAULT_PACKING_TEMPLATE: string[] = [
  'Chargers',
  'Contacts',
  'Glasses',
  'Kit',
  'Night clothes',
  'Comb'
];

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
