import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { AnswerBlocks, answerText } from '@/components/AnswerBlocks';
import { ANSWER_TOPICS, answerTopic } from '@/lib/site/answers';

const SITE = 'https://heyrhai.com';

export function generateStaticParams() {
  return ANSWER_TOPICS.map(t => ({ topic: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const { topic: slug } = await params;
  const topic = answerTopic(slug);
  if (!topic) return {};
  return {
    title: topic.metaTitle,
    description: topic.metaDescription,
    alternates: { canonical: `/answers/${topic.slug}` },
    openGraph: {
      title: topic.metaTitle,
      description: topic.metaDescription,
      url: `/answers/${topic.slug}`,
      type: 'article'
    }
  };
}

export default async function AnswerTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic: slug } = await params;
  const topic = answerTopic(slug);
  if (!topic) notFound();

  // FAQPage generated from the same answers the page renders, so the schema
  // text is exactly the visible text.
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${SITE}/answers/${topic.slug}#faq`,
      url: `${SITE}/answers/${topic.slug}`,
      name: topic.title,
      about: { '@id': `${SITE}/#organization` },
      author: { '@type': 'Person', name: 'Rhea Karuturi', url: `${SITE}/about` },
      mainEntity: topic.answers.map(a => ({
        '@type': 'Question',
        name: a.q,
        acceptedAnswer: { '@type': 'Answer', text: answerText(a) }
      }))
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Answers', item: `${SITE}/answers` },
        { '@type': 'ListItem', position: 3, name: topic.title, item: `${SITE}/answers/${topic.slug}` }
      ]
    }
  ];

  const others = ANSWER_TOPICS.filter(t => t.slug !== topic.slug);

  return (
    <main className="min-h-screen bg-cream text-ink-900">
      <SiteHeader />
      {jsonLd.map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      ))}

      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <p className="eyebrow">
            <Link href="/answers" className="hover:text-accent">
              Answers
            </Link>
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight text-ink-900 sm:text-5xl">
            {topic.title}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-ink-700">{topic.intro}</p>
          <p className="mt-4 text-xs text-ink-400">
            Answered by Rhea Karuturi, founder of <Link href="/about" className="underline underline-offset-2 hover:text-accent">Rhai</Link>.
          </p>
        </div>
      </section>

      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <AnswerBlocks answers={topic.answers} />
        </div>
      </section>

      <section className="border-b border-ink-200/60 bg-cream-50">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <p className="eyebrow">More answers</p>
          <ul className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {others.map(t => (
              <li key={t.slug}>
                <Link href={`/answers/${t.slug}`} className="text-sm text-ink-800 hover:text-accent">
                  {t.title} →
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
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
