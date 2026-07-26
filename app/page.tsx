import type { Metadata } from 'next';
import { RhaiHome } from '@/components/RhaiHome';
import { FAQS } from '@/lib/site/faq';

export const dynamic = 'force-dynamic';

const SITE = 'https://heyrhai.com';

export const metadata: Metadata = {
  title: 'Rhai — AI workshops and intelligence dashboards for Indian companies',
  description:
    'Rhai is an AI practice in Bangalore. We teach your team to build with AI in a day, and we build the intelligence dashboards they run the business on. You own everything from minute one.',
  alternates: { canonical: '/' }
};

export default function HomePage() {
  // Organization + service + FAQ structured data. `sameAs` is how search and
  // answer engines tie heyrhai.com to the Instagram account and Rhea's other
  // profiles into one entity.
  const organizationLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${SITE}/#organization`,
    name: 'Rhai',
    alternateName: 'Rhai — AI practice',
    url: SITE,
    description:
      'AI consulting practice in Bangalore. Hands-on AI workshops and custom intelligence dashboards for Indian companies.',
    email: 'rhea@rosebazaar.in',
    areaServed: [
      { '@type': 'Country', name: 'India' },
      { '@type': 'City', name: 'Bengaluru' },
      { '@type': 'City', name: 'San Francisco' }
    ],
    address: { '@type': 'PostalAddress', addressLocality: 'Bengaluru', addressRegion: 'Karnataka', addressCountry: 'IN' },
    sameAs: [
      'https://www.instagram.com/heyrhai/',
      'https://rheakaru.github.io',
      'https://rheakaruturi.substack.com'
    ],
    founder: {
      '@type': 'Person',
      name: 'Rhea Karuturi',
      jobTitle: 'Founder',
      url: 'https://rheakaru.github.io',
      alumniOf: { '@type': 'CollegeOrUniversity', name: 'Stanford University' },
      sameAs: ['https://www.instagram.com/heyrhai/', 'https://rheakaruturi.substack.com']
    },
    knowsAbout: [
      'AI consulting',
      'AI workshops',
      'Intelligence dashboards',
      'AI agents',
      'AI deployment',
      'Large language models'
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Rhai services',
      itemListElement: [
        {
          '@type': 'Offer',
          name: 'Intro AI session',
          description: 'A three-hour hands-on introduction to building with AI for your team.',
          priceCurrency: 'INR',
          price: 100000,
          itemOffered: { '@type': 'Service', name: 'Intro AI session', serviceType: 'AI workshop' }
        },
        {
          '@type': 'Offer',
          name: 'Company AI session',
          description:
            'A full day building against a real problem, customised to your company after a discovery call. You leave with a working prototype.',
          priceCurrency: 'INR',
          price: 300000,
          itemOffered: { '@type': 'Service', name: 'Company AI session', serviceType: 'AI workshop' }
        },
        {
          '@type': 'Offer',
          name: 'Commissioned intelligence dashboard',
          description:
            'A custom intelligence layer that reads your data, briefs each leader daily, and drafts the response.',
          itemOffered: { '@type': 'Service', name: 'Intelligence dashboard build', serviceType: 'Software development' }
        }
      ]
    }
  };

  const websiteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE}/#website`,
    url: SITE,
    name: 'Rhai',
    publisher: { '@id': `${SITE}/#organization` },
    inLanguage: 'en-IN'
  };

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([organizationLd, websiteLd, faqLd]) }}
      />
      <RhaiHome />
    </>
  );
}
