// Unlisted, email-gated documents shared by link (heyrhai.com/p/<slug>).
// Not in the sitemap, disallowed in robots.txt, noindex. A reader enters an
// email once (no password, no account) and every open is logged — who, when,
// how far they read and for how long — for the operator view at
// /admin/shared-docs.

export interface SharedDoc {
  slug: string;
  title: string;
  /** Shown on the email gate and in link previews. */
  description: string;
  /** Who the gate says is sharing it. */
  author: string;
}

export const SHARED_DOCS: SharedDoc[] = [
  {
    slug: 'decurve',
    title: 'DeCurve',
    description: 'Building a world model for perishable decay. A working document.',
    author: 'Rhea Karuturi'
  }
];

export function sharedDoc(slug: string): SharedDoc | undefined {
  return SHARED_DOCS.find(d => d.slug === slug);
}
