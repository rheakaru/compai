import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader, INSTAGRAM_URL, PERSONAL_SITE, SUBSTACK_URL } from '@/components/SiteChrome';
import { allPosts } from '@/lib/writing/posts';
import { MODULE_COUNT } from '@/lib/site/workshops';

const SITE = 'https://heyrhai.com';
const URL = `${SITE}/about/rhea-karuturi`;

export const metadata: Metadata = {
  title: 'Rhea Karuturi — founder of Rhai, AI workshops and intelligence dashboards',
  description:
    'Rhea Karuturi is the founder of Rhai, an AI practice in Bangalore and San Francisco that teaches companies to build with AI. Previously CTO and co-founder of Hoovu Fresh; Stanford; Shark Tank India.',
  alternates: { canonical: '/about/rhea-karuturi' },
  openGraph: {
    title: 'Rhea Karuturi — founder of Rhai',
    description:
      'Founder of Rhai, an AI practice in Bangalore and San Francisco. Previously CTO and co-founder of Hoovu Fresh.',
    url: '/about/rhea-karuturi',
    type: 'profile'
  }
};

// One source for the visible FAQ and its schema.
const FAQS = [
  {
    q: 'Who is Rhea Karuturi?',
    a: 'Rhea Karuturi is the founder of Rhai, an AI practice based in Bangalore and San Francisco that runs hands-on AI workshops for companies and builds the intelligence dashboards their leadership runs the business on. Before Rhai she spent seven years as CTO and co-founder of Hoovu Fresh. She studied at Stanford and has appeared on Shark Tank India.'
  },
  {
    q: 'What does Rhea Karuturi do now?',
    a: 'Rhea Karuturi runs Rhai. She leads every engagement herself: AI workshops for company teams, custom intelligence dashboards, and AI-backed consultancy. She also hosts Hang w AI, a free in-person community in Bangalore and Hyderabad where operators and founders build with AI every week or two.'
  },
  {
    q: 'What is Rhai?',
    a: 'Rhai is the AI practice Rhea Karuturi founded. It teaches Indian companies to build with AI on their own systems through in-person workshops, and builds custom intelligence dashboards. Rhai has worked with companies including Dodla Dairy, Bliss Aerospace and Hester Biosciences.'
  },
  {
    q: 'How is Rhai connected to Hoovu Fresh?',
    a: 'Rhai grew out of Hoovu Fresh. As CTO, Rhea Karuturi built the AI layer that runs Hoovu’s B2B puja-flower supply chain across nine Indian cities — it began as a weekend project. Rhai is that same hands-on approach turned outward, for other companies.'
  },
  {
    q: 'How do I contact Rhea Karuturi about a workshop or talk?',
    a: 'Email rhea@heyrhai.com, or start a conversation from heyrhai.com. Rhai works on site in Bangalore and San Francisco, and travels for engagements elsewhere.'
  }
];

export default function RheaPage() {
  const posts = allPosts().slice(0, 8);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      '@id': `${URL}#profile`,
      url: URL,
      name: 'Rhea Karuturi',
      mainEntity: {
        '@type': 'Person',
        '@id': `${URL}#person`,
        name: 'Rhea Karuturi',
        url: URL,
        jobTitle: 'Founder, Rhai',
        description:
          'Founder of Rhai, an AI practice in Bangalore and San Francisco. Previously CTO and co-founder of Hoovu Fresh.',
        email: 'rhea@heyrhai.com',
        worksFor: { '@type': 'ProfessionalService', '@id': `${SITE}/#organization`, name: 'Rhai', url: SITE },
        founderOf: { '@id': `${SITE}/#organization` },
        alumniOf: [
          { '@type': 'CollegeOrUniversity', name: 'Stanford University' },
          { '@type': 'Organization', name: 'Hoovu Fresh' }
        ],
        homeLocation: { '@type': 'City', name: 'Bengaluru' },
        workLocation: [
          { '@type': 'City', name: 'Bengaluru' },
          { '@type': 'City', name: 'San Francisco' }
        ],
        knowsAbout: [
          'AI workshops',
          'AI training for teams',
          'Intelligence dashboards',
          'AI agents',
          'AI deployment in Indian companies',
          'Supply chain technology'
        ],
        sameAs: [INSTAGRAM_URL, SUBSTACK_URL, PERSONAL_SITE]
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${URL}#faq`,
      mainEntity: FAQS.map(f => ({
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
        { '@type': 'ListItem', position: 2, name: 'About', item: `${SITE}/about` },
        { '@type': 'ListItem', position: 3, name: 'Rhea Karuturi', item: URL }
      ]
    }
  ];

  return (
    <main className="min-h-screen bg-cream text-ink-900">
      <SiteHeader />
      {jsonLd.map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      ))}

      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
          <p className="eyebrow">
            <Link href="/about" className="hover:text-accent">
              About
            </Link>{' '}
            · Founder
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight text-ink-900 sm:text-6xl">
            Rhea Karuturi
          </h1>
          <p className="mt-6 text-xl leading-relaxed text-ink-800">
            Founder of <Link href="/" className="text-accent underline-offset-4 hover:underline">Rhai</Link>, an AI
            practice in Bangalore and San Francisco that teaches companies to build with AI — and builds the
            intelligence dashboards their leadership runs the business on.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-ink-600">
            Previously CTO and co-founder of Hoovu Fresh · Stanford · Shark Tank India
          </p>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <a href="mailto:rhea@heyrhai.com" className="text-accent underline-offset-4 hover:underline">
              rhea@heyrhai.com
            </a>
            <a href={INSTAGRAM_URL} target="_blank" rel="me noreferrer" className="text-accent underline-offset-4 hover:underline">
              Instagram ↗
            </a>
            <a href={SUBSTACK_URL} target="_blank" rel="me noreferrer" className="text-accent underline-offset-4 hover:underline">
              Substack ↗
            </a>
            <a href={PERSONAL_SITE} target="_blank" rel="me noreferrer" className="text-accent underline-offset-4 hover:underline">
              Personal site ↗
            </a>
          </div>
        </div>
      </section>

      <Block eyebrow="Now" title="What Rhea does at Rhai">
        <p>
          Rhea runs Rhai and leads every engagement herself. The work is in person and hands-on: she goes to a
          company&apos;s office, sits with its teams, and builds alongside them on their own systems, so that the
          company owns everything from minute one.
        </p>
        <ul className="mt-5 space-y-3">
          <Item>
            <strong>AI workshops for companies.</strong> Sessions from a three-hour intro to a full customised day,
            assembled from a library of {MODULE_COUNT} modules.{' '}
            <Link href="/workshops" className="text-accent underline-offset-4 hover:underline">
              Workshop formats →
            </Link>
          </Item>
          <Item>
            <strong>Intelligence dashboards.</strong> Custom dashboards that brief each leader every morning and
            draft the next action, rather than only reporting what happened.
          </Item>
          <Item>
            <strong>Hang w AI.</strong> A free in-person community in Bangalore and Hyderabad, with more than 350
            members, where a dozen people at a time build with AI.{' '}
            <Link href="/hang-w-ai" className="text-accent underline-offset-4 hover:underline">
              About Hang w AI →
            </Link>
          </Item>
        </ul>
      </Block>

      <Block eyebrow="Work" title="Companies she has worked with through Rhai" tint>
        <ul className="space-y-3">
          <Item>
            <strong>Dodla Dairy</strong> — two months of discovery, a 70-page demo intelligence dashboard, and a
            two-day leadership workshop.{' '}
            <Link href="/writing/dodla-dairy" className="text-accent underline-offset-4 hover:underline">
              Field notes →
            </Link>
          </Item>
          <Item>
            <strong>Bliss Aerospace</strong> — a build day with the planning team that produced a working production
            scheduler on a Microsoft tenant they already owned.
          </Item>
          <Item>
            <strong>Hester Biosciences</strong> — an engagement on turning leadership&apos;s AI momentum into
            owners across the company.{' '}
            <Link href="/writing/hester-biosciences" className="text-accent underline-offset-4 hover:underline">
              Read the write-up →
            </Link>
          </Item>
        </ul>
        <p className="mt-5">
          More than a dozen companies have been through Rhai&apos;s workshops, across real estate, aerospace,
          manufacturing, F&amp;B, healthcare and fintech.
        </p>
      </Block>

      <Block eyebrow="Before Rhai" title="Background">
        <p>
          Rhea spent seven years as CTO and co-founder of Hoovu Fresh, a B2B puja-flower supply chain operating across
          nine Indian cities, where she built and ran the AI layer the operation runs on. It started as a weekend
          project. Hoovu Fresh appeared on Shark Tank India.
        </p>
        <p className="mt-4">
          She studied at Stanford. Rhai is the Hoovu experience turned outward: the same way of deploying AI inside a
          real operating business, taught to and built with other companies.
        </p>
      </Block>

      {posts.length > 0 && (
        <Block eyebrow="Writing" title="Field notes and build logs" tint>
          <ul className="space-y-2">
            {posts.map(p => (
              <li key={p.slug}>
                <Link href={`/writing/${p.slug}`} className="text-ink-800 underline decoration-ink-200 underline-offset-4 hover:text-accent hover:decoration-accent">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-5">
            <Link href="/writing" className="text-accent underline-offset-4 hover:underline">
              All writing →
            </Link>
          </p>
        </Block>
      )}

      <Block eyebrow="FAQ" title="Questions about Rhea Karuturi">
        <div className="space-y-6">
          {FAQS.map(f => (
            <div key={f.q}>
              <h3 className="font-display text-lg tracking-tight text-ink-900">{f.q}</h3>
              <p className="mt-2">{f.a}</p>
            </div>
          ))}
        </div>
      </Block>

      <section>
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-display text-2xl tracking-tight text-ink-900 sm:text-3xl">Work with Rhea</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/#contact" className="rounded-md bg-ink-900 px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink-800">
              Start a conversation →
            </Link>
            <Link href="/about" className="rounded-md border border-ink-300 bg-white/70 px-5 py-2.5 text-sm font-medium text-ink-800 hover:bg-white">
              About Rhai
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Block({ eyebrow, title, tint, children }: { eyebrow: string; title: string; tint?: boolean; children: React.ReactNode }) {
  return (
    <section className={`border-b border-ink-200/60 ${tint ? 'bg-cream-50' : ''}`}>
      <div className="mx-auto max-w-3xl px-6 py-14">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-3 font-display text-3xl tracking-tight text-ink-900">{title}</h2>
        <div className="mt-6 text-sm leading-relaxed text-ink-700">{children}</div>
      </div>
    </section>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
      <span>{children}</span>
    </li>
  );
}
