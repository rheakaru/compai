// Launch-party RSVPs. Two intake paths share this collection:
//  • /party  — the full invite for people already on the guest list. They RSVP
//    directly and are `confirmed` on submit; the page shows the venue.
//  • /join    — a request page for the broader community. No venue is shown.
//    They land as `pending`; once an operator approves them, the page unlocks
//    the location + details on their next visit.
// Isomorphic types + constants (kept out of route files so those export only
// handlers).

export const COL_RSVPS = 'rhaiRsvps';

export type RsvpList = 'guest' | 'request';
export type RsvpStatus = 'confirmed' | 'pending' | 'approved' | 'declined';

export interface PartyRsvp {
  id: string;
  name: string;
  contact: string; // as typed — WhatsApp number or email
  contactType: 'phone' | 'email';
  contactKey: string; // normalized (digits / lowercased email) — dedupe key
  guests: 1 | 2; // just me / me +1
  note?: string; // for requests: "how do you know Rhai / which sessions"
  list: RsvpList;
  status: RsvpStatus;
  createdAt: number;
  updatedAt: number;
}

/** Details revealed only to confirmed/approved guests (never on the /join page
 *  until approval). One source of truth for the component + status endpoint. */
export const PARTY_EVENT = {
  date: 'Sunday, 19 July 2026',
  time: '3:00 PM onwards',
  venue: '1391, 3rd Cross, 9th Main, Judicial Layout, Bengaluru 560065',
  startUtc: '2026-07-19T09:30:00Z', // 3:00 PM IST
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('1391, 3rd Cross, 9th Main, Judicial Layout, Bengaluru 560065'),
  calUrl:
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent('Rhai Launch Party · Hang w AI, Episode X')}` +
    '&dates=20260719T093000Z/20260719T133000Z' +
    `&details=${encodeURIComponent("You're on the list. Special news, shared in person. — heyrhai.com/party")}` +
    `&location=${encodeURIComponent('1391, 3rd Cross, 9th Main, Judicial Layout, Bengaluru 560065')}`
} as const;

/** A guest counts toward the headcount when they're going for sure. */
export const IS_GOING = (s: RsvpStatus) => s === 'confirmed' || s === 'approved';
