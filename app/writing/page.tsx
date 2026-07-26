import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { allPosts } from '@/lib/writing/posts';

export const metadata: Metadata = {
  title: 'Writing — build logs from the Rhai practice',
  description:
    'Build logs and field guides from Rhea Karuturi: AI-run dashboards, agents inside operations, vernacular voice AI, and tools built for real Indian businesses.',
  alternates: { canonical: '/writing' },
  openGraph: {
    title: 'Writing — build logs from the Rhai practice',
    description:
      'Build logs and field guides: AI-run dashboards, agents inside operations, vernacular voice AI, and tools built for real Indian businesses.',
    url: '/writing',
    type: 'website'
  }
};

export default function WritingIndexPage() {
  const posts = allPosts();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Writing — Rhai',
    description:
      'Build logs and field guides from the Rhai practice: AI dashboards, agents inside operations, and tools built for Indian businesses.',
    url: 'https://heyrhai.com/writing',
    hasPart: posts.map(p => ({
      '@type': 'Article',
      headline: p.title,
      description: p.dek,
      url: `https://heyrhai.com/writing/${p.slug}`,
      author: { '@type': 'Person', name: 'Rhea Karuturi' }
    }))
  };

  return (
    <main className="min-h-screen bg-cream text-ink-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />

      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
          <p className="eyebrow">Writing</p>
          <h1 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight text-ink-900 sm:text-5xl">
            Build logs, not thought leadership.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-ink-700">
            Everything here is something we actually built and shipped — an AI-run operating system for a flower
            supply chain, agents that live inside dashboards, a vernacular voice HR partner, a diagnosis tool that
            refuses to fake completeness. Written up honestly, including the parts that didn&apos;t work.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-6 py-16">
          {posts.length === 0 ? (
            <p className="text-sm text-ink-500">No posts yet.</p>
          ) : (
            <div className="space-y-3">
              {posts.map(post => (
                <Link
                  key={post.slug}
                  href={`/writing/${post.slug}`}
                  className="block rounded-xl border border-ink-200 bg-white p-6 transition-colors hover:border-accent/50"
                >
                  <h2 className="font-display text-xl tracking-tight text-ink-900 sm:text-2xl">{post.title}</h2>
                  {post.dek && <p className="mt-2 text-sm leading-relaxed text-ink-700">{post.dek}</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[10px] text-ink-400">
                    <span>{post.readingMinutes} min read</span>
                    {post.tags.slice(0, 4).map(tag => (
                      <span key={tag} className="rounded-full border border-ink-200 bg-cream-50 px-2 py-0.5">
                        {tag}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-12 rounded-xl border border-ink-200 bg-cream-100 p-6">
            <p className="eyebrow text-accent">Want one of these for your company?</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">
              Most of these started as a workshop or a week inside someone&apos;s operation. That&apos;s how ours start
              too.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/talk"
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
              >
                Start a conversation →
              </Link>
              <Link
                href="/hang-w-ai"
                className="rounded-md border border-ink-300 bg-white/70 px-4 py-2 text-sm font-medium text-ink-800 hover:bg-white"
              >
                Come to Hang w AI
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
