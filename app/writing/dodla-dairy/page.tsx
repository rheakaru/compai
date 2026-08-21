import type { Metadata } from 'next';
import { Fraunces, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import { DodlaCaseStudy } from '@/components/DodlaCaseStudy';

// A dedicated route so this one post keeps its own design instead of being
// flattened into the shared editorial-prose template. A static segment wins
// over /writing/[slug], so the markdown file stays as the archive's source of
// title/dek/tags and this renders the page itself.
//
// The three faces the design depends on are loaded through next/font, which
// self-hosts them at build time — the rest of the site stays on system fonts
// and makes no external font request.

const SITE = 'https://heyrhai.com';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--dodla-serif',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif']
});
const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--dodla-sans',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif']
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--dodla-mono',
  display: 'swap',
  fallback: ['Menlo', 'Courier New', 'monospace']
});

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
    <div className={`${fraunces.variable} ${interTight.variable} ${jetbrains.variable}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <DodlaCaseStudy />
    </div>
  );
}
