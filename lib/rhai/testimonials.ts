// Voice testimonials — attendees leave a short voice note about a Hang w AI
// session. Rhea curates which appear on heyrhai.com (and in what order); the
// public site plays only the approved ones. Isomorphic types + collection name
// (kept out of route files so those export only handlers).

export const COL_TESTIMONIALS = 'rhaiTestimonials';

export interface Testimonial {
  id: string;
  name: string;
  role?: string; // "what they do" — optional
  audioUrl: string; // streaming route, e.g. /api/testimonial/{id}/audio
  storagePath?: string; // object path in the media bucket
  mime?: string;
  transcript: string;
  durationSec?: number;
  displayed: boolean; // shown on heyrhai.com
  order: number; // display order among shown (lower first)
  createdAt: number;
}

/** Public shape sent to the homepage — no internal flags. */
export interface PublicTestimonial {
  id: string;
  name: string;
  role?: string;
  audioUrl: string;
  transcript: string;
}
