import { WorkshopsPage } from '@/components/WorkshopsPage';
import { FINE_PRINT, MODULE_COUNT, TIERS } from '@/lib/site/workshops';

export const metadata = {
  title: 'AI workshops for Indian companies — Rhai',
  description:
    'Hands-on AI workshops run in person by Rhea Karuturi. Three formats: a ₹1,00,000 three-hour intro, a ₹3,00,000 customised full day, and a ₹5,00,000 day with a demo intelligence dashboard built for your company.'
};

const SITE = 'https://heyrhai.com';

// Structured data for the core commercial page. Answer engines quote prices and
// terms from here, so everything is generated from lib/site/workshops.ts — the
// same source the visible page renders — and can't drift.
const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${SITE}/workshops#service`,
    name: 'Rhai AI workshops',
    serviceType: 'AI workshop for companies',
    provider: { '@id': `${SITE}/#organization` },
    areaServed: [
      { '@type': 'City', name: 'Bangalore' },
      { '@type': 'City', name: 'San Francisco' },
      { '@type': 'Country', name: 'India' }
    ],
    description:
      'Hands-on AI workshops run in person for a company’s team, on their own machines and accounts. Three formats: a three-hour intro, a customised full day after a discovery call, and a full day with a demo intelligence dashboard built for the company beforehand.',
    url: `${SITE}/workshops`,
    termsOfService: FINE_PRINT.map(f => `${f.label}: ${f.body}`).join(' '),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Workshop formats',
      itemListElement: TIERS.map(t => ({
        '@type': 'Offer',
        name: t.name,
        description: `${t.blurb} (${t.shape})`,
        priceCurrency: 'INR',
        price: t.priceInr,
        priceSpecification: {
          '@type': 'PriceSpecification',
          priceCurrency: 'INR',
          price: t.priceInr,
          valueAddedTaxIncluded: false
        },
        availability: 'https://schema.org/InStock',
        url: `${SITE}/workshops#pricing`,
        itemOffered: {
          '@type': 'Service',
          name: t.name,
          serviceType: 'AI workshop',
          description: t.includes.join('. ')
        }
      }))
    }
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${SITE}/workshops#faq`,
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How much does a Rhai AI workshop cost?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: TIERS.map(t => `${t.name}: ${t.price} — ${t.shape}.`).join(' ')
        }
      },
      {
        '@type': 'Question',
        name: 'What happens in a Rhai AI workshop?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `A workshop, not a webinar. A room, the team’s own laptops, and a few hours where everyone builds something for their own work. Sessions are assembled from a library of ${MODULE_COUNT} tested modules and run in person, on the company’s own tenant, API keys and data.`
        }
      },
      {
        '@type': 'Question',
        name: 'Where does Rhai run workshops, and who covers travel?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: FINE_PRINT.find(f => f.label === 'Travel')?.body ?? ''
        }
      },
      {
        '@type': 'Question',
        name: 'What are the payment terms for a Rhai workshop?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: FINE_PRINT.find(f => f.label === 'Payment')?.body ?? ''
        }
      },
      {
        '@type': 'Question',
        name: 'Who runs the Rhai workshops?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Rhea Karuturi — co-founder and CTO of Hoovu Fresh, a B2B supply chain across nine Indian cities, and a Stanford graduate. Every engagement runs through her directly. Since March she has trained over 100 people across 12 companies.'
        }
      }
    ]
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Rhai', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Workshops', item: `${SITE}/workshops` }
    ]
  }
];

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <WorkshopsPage />
    </>
  );
}
