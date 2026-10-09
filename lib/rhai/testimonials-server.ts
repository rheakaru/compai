import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { COL_TESTIMONIALS, type PublicTestimonial, type Testimonial } from './testimonials';

// The approved voice testimonials, in display order. Shared by the public API
// and by the homepage's server render — the homepage needs them at render time
// so the transcripts are in the HTML itself (readable by crawlers and AI
// agents), not fetched after hydration.

/** Cache-busted stream URL: the audio route is cached immutable for a year, so
 *  the URL is versioned by storage path and changes whenever the object does. */
function audioUrlFor(t: Testimonial & { id: string }): string {
  const base = t.audioUrl || `/api/testimonial/${t.id}/audio`;
  if (!t.storagePath) return base;
  let h = 0;
  for (let i = 0; i < t.storagePath.length; i++) h = (Math.imul(31, h) + t.storagePath.charCodeAt(i)) | 0;
  return `${base}${base.includes('?') ? '&' : '?'}v=${(h >>> 0).toString(36)}`;
}

export async function listPublicTestimonials(): Promise<PublicTestimonial[]> {
  const snap = await adminDb().collection(COL_TESTIMONIALS).where('displayed', '==', true).get();
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<Testimonial, 'id'>) }))
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
    .map(t => ({
      id: t.id,
      name: t.name,
      ...(t.role ? { role: t.role } : {}),
      audioUrl: audioUrlFor(t),
      transcript: t.transcript ?? ''
    }));
}
