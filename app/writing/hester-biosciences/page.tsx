import type { Metadata } from 'next';
import { HesterCaseStudy } from '@/components/HesterCaseStudy';

// Dedicated route so this post keeps its own design instead of the shared
// editorial-prose template. A static segment wins over /writing/[slug], so the
// markdown file stays the archive's source of title/dek/tags; this renders the
// page. Fonts are vendored in public/fonts (see the note in HesterCaseStudy).

const SITE = 'https://heyrhai.com';

const title = 'How to make twenty champions';
const description =
  'Field notes from an AI workshop at a 40-year-old, ₹2,000 Cr animal health company: why adoption fails at deployment, not motivation — and how a page built for each person kills the blank-page problem.';

export const metadata: Metadata = {
  title: `${title} — Rhai`,
  description,
  keywords: ['workshop', 'adoption', 'dashboard', 'agents', 'champions', 'case-study'],
  alternates: { canonical: '/writing/hester-biosciences' },
  openGraph: {
    title,
    description,
    url: '/writing/hester-biosciences',
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
  keywords: 'workshop, adoption, dashboard, agents, champions, case-study',
  url: `${SITE}/writing/hester-biosciences`,
  mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/writing/hester-biosciences` },
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
      <HesterCaseStudy />
    </>
  );
}
