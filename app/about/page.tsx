import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { ABOUT } from '@/lib/site/about';

const SITE = 'https://heyrhai.com';

export const metadata: Metadata = {
  title: 'About Rhai — an AI practice in Bangalore for Indian companies',
  description:
    'Rhai is an AI consulting practice in Bangalore that teaches Indian companies to build with AI on their own systems, and builds the intelligence dashboards leadership runs the business on. Founder, services, differentiators, clients, and key facts.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About Rhai',
    description:
      'An AI consulting practice in Bangalore. Workshops that teach your team to build with AI, and the intelligence dashboards leadership runs the business on.',
    url: '/about',
    type: 'website'
  }
};

export default function AboutPage() {
  // Structured data: an AboutPage that describes the Organization, its offers,
  // and a FAQPage — all generated from the same ABOUT object the page renders,
  // so schema and visible copy can never drift.
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      '@id': `${SITE}/about#aboutpage`,
      url: `${SITE}/about`,
      name: 'About Rhai',
      description: ABOUT.valueProp,
      about: { '@id': `${SITE}/#organization` },
      primaryImageOfPage: undefined,
      mainEntity: {
        '@type': 'ProfessionalService',
        '@id': `${SITE}/#organization`,
        name: 'Rhai',
        legalName: 'RHAI Consulting Group Private Limited',
        url: SITE,
        description: ABOUT.valueProp,
        email: 'rhea@heyrhai.com',
        foundingDate: '2026',
        areaServed: [
          { '@type': 'Country', name: 'India' },
          { '@type': 'City', name: 'Bengaluru' },
          { '@type': 'City', name: 'Hyderabad' },
          { '@type': 'City', name: 'San Francisco' }
        ],
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Bengaluru',
          addressRegion: 'Karnataka',
          addressCountry: 'IN'
        },
        founder: {
          '@type': 'Person',
          name: 'Rhea Karuturi',
          jobTitle: 'Founder',
          alumniOf: { '@type': 'CollegeOrUniversity', name: 'Stanford University' },
          url: 'https://rheakaru.github.io',
          sameAs: ['https://www.instagram.com/heyrhai/', 'https://rheakaruturi.substack.com']
        },
        sameAs: [
          'https://www.instagram.com/heyrhai/',
          'https://rheakaru.github.io',
          'https://rheakaruturi.substack.com'
        ],
        knowsAbout: [
          'AI consulting',
          'AI workshops',
          'Intelligence dashboards',
          'AI deployment',
          'AI agents',
          'Large language models'
        ],
        makesOffer: ABOUT.services.map(s => ({
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: s.name, description: s.body }
        }))
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${SITE}/about#faq`,
      mainEntity: ABOUT.faqs.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'About', item: `${SITE}/about` }
      ]
    }
  ];

  return (
    <main className="min-h-screen bg-cream text-ink-900">
      <SiteHeader />

      {jsonLd.map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}

      {/* Hero — value prop */}
      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
          <p className="eyebrow">About</p>
          <h1 className="mt-4 font-display text-3xl leading-[1.12] tracking-tight text-ink-900 sm:text-[2.75rem]">
            {ABOUT.valueProp}
          </h1>
          <p className="mt-6 text-sm leading-relaxed text-ink-600">
            An AI practice by Rhea Karuturi — Bangalore and San Francisco. Below: what we do, what makes us
            different, who we work with, the team, how we work, the key facts, and answers to the questions we get
            most.
          </p>
        </div>
      </section>

      {/* 2 — What Rhai does */}
      <Section eyebrow="What we do" title="What Rhai does">
        <div className="mt-8 space-y-8">
          {ABOUT.services.map(s => (
            <div key={s.name}>
              <h3 className="font-display text-xl tracking-tight text-ink-900">{s.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 3 — What makes Rhai different */}
      <Section eyebrow="Why us" title="What makes Rhai different" tint>
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          {ABOUT.differentiators.map(d => (
            <div key={d.name}>
              <h3 className="font-display text-lg tracking-tight text-ink-900">{d.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{d.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 4 — Who uses Rhai */}
      <Section eyebrow="Who it's for" title="Who uses Rhai">
        <ul className="mt-8 space-y-3">
          {ABOUT.icp.map((seg, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-700">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
              <span>{seg}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* 5 — The team */}
      <Section eyebrow="The team" title="The team behind Rhai" tint>
        <p className="mt-6 text-sm leading-relaxed text-ink-700">{ABOUT.team.origin}</p>
        <div className="mt-8 space-y-8">
          {ABOUT.team.people.map(p => (
            <div key={p.name}>
              <h3 className="font-display text-xl tracking-tight text-ink-900">
                {p.name} <span className="text-ink-400">· {p.role}</span>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{p.bio}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {p.links.map(l => (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    {l.label} ↗
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm leading-relaxed text-ink-600">{ABOUT.team.composition}</p>
      </Section>

      {/* 6 — How Rhai works */}
      <Section eyebrow="How it works" title="How Rhai works">
        <dl className="mt-8 space-y-6">
          {ABOUT.howItWorks.map(step => (
            <div key={step.label} className="grid gap-1 sm:grid-cols-[180px_1fr] sm:gap-6">
              <dt className="font-display text-sm text-ink-900">{step.label}</dt>
              <dd className="text-sm leading-relaxed text-ink-700">{step.body}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* 7 — Key facts (crawlable definition list) */}
      <Section eyebrow="For the record" title="Key facts" tint>
        <dl className="mt-8 divide-y divide-ink-200/70 overflow-hidden rounded-xl border border-ink-200 bg-white">
          {ABOUT.keyFacts.map(([k, v]) => (
            <div key={k} className="grid gap-1 px-5 py-4 sm:grid-cols-[200px_1fr] sm:gap-6">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{k}</dt>
              <dd className="text-sm leading-relaxed text-ink-800">
                {k === 'Website' ? (
                  <a href={SITE} className="text-accent underline-offset-4 hover:underline">
                    heyrhai.com
                  </a>
                ) : (
                  v
                )}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* 8 — FAQ */}
      <Section eyebrow="FAQ" title="Frequently asked questions">
        <div className="mt-8 space-y-6">
          {ABOUT.faqs.map(f => (
            <div key={f.q}>
              <h3 className="font-display text-lg tracking-tight text-ink-900">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{f.a}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <section className="border-t border-ink-200/60">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-display text-2xl tracking-tight text-ink-900 sm:text-3xl">
            Want to see what this looks like inside your company?
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/#contact" className="rounded-md bg-ink-900 px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink-800">
              Start a conversation →
            </Link>
            <Link
              href="/workshops"
              className="rounded-md border border-ink-300 bg-white/70 px-5 py-2.5 text-sm font-medium text-ink-800 hover:bg-white"
            >
              See the workshops
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Section({
  eyebrow,
  title,
  tint,
  children
}: {
  eyebrow: string;
  title: string;
  tint?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`border-b border-ink-200/60 ${tint ? 'bg-cream-50' : ''}`}>
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">{title}</h2>
        {children}
      </div>
    </section>
  );
}
