import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { answerAnchor } from '@/components/AnswerBlocks';
import { ANSWER_COUNT, ANSWER_TOPICS } from '@/lib/site/answers';

const SITE = 'https://heyrhai.com';

export const metadata: Metadata = {
  title: 'Answers — AI workshops, teaching teams, marketing, real estate, security | Rhai',
  description:
    'Straight answers to the questions companies ask about AI workshops in Bangalore and San Francisco, training a team on AI, AI for marketing and real estate, and AI security.',
  alternates: { canonical: '/answers' },
  openGraph: {
    title: 'Answers from Rhai',
    description: 'Straight answers to the questions companies ask about AI workshops and putting AI to work.',
    url: '/answers',
    type: 'website'
  }
};

export default function AnswersIndexPage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${SITE}/answers#collection`,
      url: `${SITE}/answers`,
      name: 'Answers from Rhai',
      isPartOf: { '@id': `${SITE}/#organization` },
      hasPart: ANSWER_TOPICS.map(t => ({
        '@type': 'FAQPage',
        name: t.title,
        url: `${SITE}/answers/${t.slug}`
      }))
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Answers', item: `${SITE}/answers` }
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
          <p className="eyebrow">Answers · {ANSWER_COUNT} questions</p>
          <h1 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight text-ink-900 sm:text-5xl">
            The questions we get asked, <span className="text-ink-400">answered plainly.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-ink-700">
            What companies in Bangalore and San Francisco ask before they bring AI to their teams — about workshops,
            teaching non-technical people, marketing, real estate, and what happens to their data.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="space-y-12">
            {ANSWER_TOPICS.map(topic => (
              <div key={topic.slug}>
                <h2 className="font-display text-2xl tracking-tight text-ink-900">
                  <Link href={`/answers/${topic.slug}`} className="hover:text-accent">
                    {topic.title}
                  </Link>
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{topic.intro}</p>
                <ul className="mt-4 space-y-2">
                  {topic.answers.map(a => (
                    <li key={a.q}>
                      <Link
                        href={`/answers/${topic.slug}#${answerAnchor(a.q)}`}
                        className="text-sm text-ink-800 underline decoration-ink-200 underline-offset-4 hover:text-accent hover:decoration-accent"
                      >
                        {a.q}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
