import type { Metadata } from 'next';
import { IgniteCaseStudy } from '@/components/IgniteCaseStudy';

// Dedicated route for the Ignite.AI write-up, in the workshop deck's design.
// A static segment wins over /writing/[slug]; the markdown file is only the
// archive listing. Copy lives in components/IgniteCaseStudy.tsx.

const SITE = 'https://heyrhai.com';

const title = 'A room full of founders, each building their own chief of staff';
const description =
  'Notes from Ignite.AI in Bengaluru, a day by SonderConnect with Anthropic and AWS, where Rhea Karuturi ran the largest Rhai workshop yet: every founder left with a working AI chief of staff, and the conference itself ran on a backend she built.';

export const metadata: Metadata = {
  title: `${title} — Rhai`,
  description,
  keywords: ['workshop', 'agents', 'chief-of-staff', 'anthropic', 'aws', 'event'],
  alternates: { canonical: '/writing/ignite-ai-chief-of-staff' },
  openGraph: {
    title,
    description,
    url: '/writing/ignite-ai-chief-of-staff',
    type: 'article',
    authors: ['Rhea Karuturi'],
    images: ['/img/writing/ignite-ai/hall.jpg']
  },
  twitter: { card: 'summary_large_image', title, description }
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: title,
  description,
  keywords: 'workshop, agents, chief-of-staff, anthropic, aws, event',
  url: `${SITE}/writing/ignite-ai-chief-of-staff`,
  mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/writing/ignite-ai-chief-of-staff` },
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
      <IgniteCaseStudy />
    </>
  );
}
