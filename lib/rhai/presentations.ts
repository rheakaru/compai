import 'server-only';
import { adminDb } from '@/lib/firebase/admin';

// Our workshop & community presentations — a rich, underused record of exactly
// how we teach and pitch. Each deck is stored in the media bucket, with an
// extracted flow index (the slide-by-slide table of contents) so the team can
// scan what's in a deck without opening it, and reuse the good bits.

export const COL_PRESENTATIONS = 'rhaiPresentations';

export interface DeckSlide {
  n: number;
  label: string;
}
export interface Presentation {
  id: string;
  title: string;
  client: string; // "Hester Biosciences", "Hang w AI · Session 4", …
  clientLeadId?: string; // linked lead, when we found one
  category: 'client' | 'community';
  dateLabel: string;
  format: 'html' | 'pdf';
  storagePath: string;
  slideCount: number;
  index: DeckSlide[];
  createdAt: number;
}

export function presentationFileUrl(id: string): string {
  return `/api/rhai/presentations/file?id=${encodeURIComponent(id)}`;
}

export async function loadPresentations(): Promise<Presentation[]> {
  const snap = await adminDb().collection(COL_PRESENTATIONS).get();
  const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Presentation, 'id'>) }));
  // Client decks first, then community; newest-ish by title within.
  return list.sort(
    (a, b) => (a.category === b.category ? a.title.localeCompare(b.title) : a.category === 'client' ? -1 : 1)
  );
}

export async function getPresentation(id: string): Promise<Presentation | null> {
  const snap = await adminDb().collection(COL_PRESENTATIONS).doc(id).get();
  return snap.exists ? ({ id: snap.id, ...(snap.data() as Omit<Presentation, 'id'>) }) : null;
}
