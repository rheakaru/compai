// Launch-party RSVPs — guests land on heyrhai.com/party (the 3D invite),
// scroll the story, and save their spot at the end. Isomorphic types +
// collection name (kept out of route files so those export only handlers).

export const COL_RSVPS = 'rhaiRsvps';

export interface PartyRsvp {
  id: string;
  name: string;
  contact: string; // as typed — WhatsApp number or email
  contactType: 'phone' | 'email';
  contactKey: string; // normalized (digits / lowercased email) — dedupe key
  guests: 1 | 2; // just me / me +1
  note?: string;
  createdAt: number;
  updatedAt: number;
}
