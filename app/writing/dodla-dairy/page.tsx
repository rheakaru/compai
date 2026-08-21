import type { Metadata } from 'next';
import { DodlaCaseStudy } from '@/components/DodlaCaseStudy';

// A dedicated route so this one post keeps its own design instead of being
// flattened into the shared editorial-prose template. A static segment wins
// over /writing/[slug], so the markdown file stays as the archive's source of
// title/dek/tags and this renders the page itself.
//
// The three faces the design depends on are vendored into public/fonts and
// declared with @font-face in the component. They are deliberately NOT loaded
// via next/font: that downloads from Google at build time, which makes the
// deploy depend on network egress from the build sandbox. Serving our own
// files keeps the build hermetic. The rest of the site stays on system fonts,
// and this page still makes no external font request at runtime.

const SITE = 'https://heyrhai.com';

const title = 'Two days inside a dairy company, rethinking it with AI';
const description =
  "Field notes from a real AI engagement with Dodla Dairy: a demo intelligence dashboard, two days of workshops with a dairy major's leadership, and what I learned about frames, champions, and rooms.";

export const metadata: Metadata = {
  title: `${title} — Rhai`,
  description,
  keywords: ['advisory', 'workshop', 'dashboard', 'agents', 'dairy', 'case-study'],
  alternates: { canonical: '/writing/dodla-dairy' },
  openGraph: {
    title,
    description,
    url: '/writing/dodla-dairy',
    type: 'article',
    authors: ['Rhea Karuturi']
  },
  twitter: { card: 'summary_large_image', title, description }
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: title,
  description,
  keywords: 'advisory, workshop, dashboard, agents, dairy, case-study',
  url: `${SITE}/writing/dodla-dairy`,
  mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/writing/dodla-dairy` },
  author: {
    '@type': 'Person',
    name: 'Rhea Karuturi',
    url: 'https://rheakaru.github.io',
    jobTitle: 'Founder, Rhai'
  },
  publisher: { '@type': 'Organization', name: 'Rhai', url: SITE },
  isAccessibleForFree: true
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <DodlaCaseStudy />
    </>
  );
}
