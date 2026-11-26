import type { Metadata } from 'next';
import { KmcCaseStudy } from '@/components/KmcCaseStudy';

// Dedicated route so this post keeps its own design instead of the shared
// editorial-prose template. A static segment wins over /writing/[slug], so the
// markdown file stays the archive's source of title/dek/tags; this renders the
// page. Fonts are vendored in public/fonts (see the note in KmcCaseStudy).

const SITE = 'https://heyrhai.com';

const title = 'Building an infrastructure of trust';
const description =
  'Field notes from a full-day AI workshop with every head of department at KMC Constructions, a ₹1,000+ Cr infrastructure builder: moving from a hierarchy that carries information to an agentic layer that moves work, and trust.';

export const metadata: Metadata = {
  title: `${title} — Rhai`,
  description,
  keywords: ['workshop', 'trust', 'agents', 'construction', 'case-study', 'testimonial'],
  alternates: { canonical: '/writing/kmc-constructions' },
  openGraph: {
    title,
    description,
    url: '/writing/kmc-constructions',
    type: 'article',
    authors: ['Rhea Karuturi'],
    images: ['/img/writing/kmc-constructions/room.jpg']
  },
  twitter: { card: 'summary_large_image', title, description }
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: title,
  description,
  keywords: 'workshop, trust, agents, construction, case-study, testimonial',
  url: `${SITE}/writing/kmc-constructions`,
  mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/writing/kmc-constructions` },
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
      <KmcCaseStudy />
    </>
  );
}
