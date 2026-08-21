import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { allPosts, postBySlug } from '@/lib/writing/posts';
import { EDITORIAL_PROSE_CLASS, excerpt, renderMarkdown } from '@/lib/markdown';

const SITE = 'https://heyrhai.com';

// Posts that have their own hand-designed route under app/writing/<slug>/.
// A static segment already wins over this dynamic one at request time; keeping
// them out of the params list stops the build from prerendering a second,
// unreachable copy from the markdown body.
const CUSTOM_ROUTES = new Set(['dodla-dairy']);

export function generateStaticParams() {
  return allPosts()
    .filter(p => !CUSTOM_ROUTES.has(p.slug))
    .map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) return { title: 'Not found — Rhai' };
  const description = post.dek || excerpt(post.body);
  return {
    title: `${post.title} — Rhai`,
    description,
    keywords: post.tags,
    alternates: { canonical: `/writing/${post.slug}` },
    openGraph: {
      title: post.title,
      description,
      url: `/writing/${post.slug}`,
      type: 'article',
      authors: ['Rhea Karuturi']
    },
    twitter: { card: 'summary_large_image', title: post.title, description }
  };
}

export default async function WritingPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) notFound();

  const html = renderMarkdown(post.body);
  const description = post.dek || excerpt(post.body);
  const others = allPosts().filter(p => p.slug !== post.slug).slice(0, 3);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description,
    keywords: post.tags.join(', '),
    url: `${SITE}/writing/${post.slug}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/writing/${post.slug}` },
    author: {
      '@type': 'Person',
      name: 'Rhea Karuturi',
      url: 'https://rheakaru.github.io',
      jobTitle: 'Founder, Rhai',
      sameAs: ['https://www.instagram.com/heyrhai/', 'https://rheakaruturi.substack.com']
    },
    publisher: { '@type': 'Organization', name: 'Rhai', url: SITE },
    isAccessibleForFree: true
  };

  return (
    <main className="min-h-screen bg-cream text-ink-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />

      <article>
        <header className="border-b border-ink-200/60">
          <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
            <Link href="/writing" className="text-xs text-ink-400 hover:text-ink-700">
              ← All writing
            </Link>
            <h1 className="mt-6 font-display text-4xl leading-[1.08] tracking-tight text-ink-900 sm:text-5xl">
              {post.title}
            </h1>
            {post.dek && <p className="mt-5 text-lg leading-relaxed text-ink-700">{post.dek}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-ink-400">
              <span>By Rhea Karuturi</span>
              <span aria-hidden>·</span>
              <span>{post.readingMinutes} min read</span>
              {post.tags.slice(0, 5).map(tag => (
                <span key={tag} className="rounded-full border border-ink-200 bg-cream-50 px-2 py-0.5">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-6 py-14">
          <div className={EDITORIAL_PROSE_CLASS} dangerouslySetInnerHTML={{ __html: html }} />

          {post.source && (
            <p className="mt-12 border-t border-ink-200 pt-5 text-[11px] text-ink-400">
              Originally published on{' '}
              <a href={post.source} target="_blank" rel="noreferrer" className="text-ink-500 hover:text-accent">
                rheakaru.github.io
              </a>
              .
            </p>
          )}
        </div>

        <section className="border-t border-ink-200/60 bg-cream-100">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <p className="eyebrow">Work with us</p>
            <h2 className="mt-3 font-display text-3xl tracking-tight text-ink-900">
              We build these for companies too.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-700">
              Rhai teaches your team to build with AI in a day, and builds the intelligence dashboards they then run
              the business on. You own everything from minute one.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/talk"
                className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-600"
              >
                Start a conversation →
              </Link>
              <Link
                href="/careers"
                className="rounded-md border border-ink-300 bg-white/70 px-5 py-2.5 text-sm font-medium text-ink-800 hover:bg-white"
              >
                We&apos;re hiring
              </Link>
            </div>

            {others.length > 0 && (
              <div className="mt-12">
                <p className="eyebrow text-ink-400">Read next</p>
                <ul className="mt-3 space-y-2">
                  {others.map(o => (
                    <li key={o.slug}>
                      <Link href={`/writing/${o.slug}`} className="text-sm text-accent hover:underline">
                        {o.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </article>

      <SiteFooter />
    </main>
  );
}
