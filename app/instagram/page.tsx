import type { Metadata } from 'next';
import { SiteFooter, SiteHeader, INSTAGRAM_URL } from '@/components/SiteChrome';
import { InstagramConnect } from '@/components/InstagramConnect';
import { getInstagramPosts, splitCaption } from '@/lib/site/instagram';

export const dynamic = 'force-dynamic';

const SITE = 'https://heyrhai.com';

export const metadata: Metadata = {
  title: 'Rhai on Instagram — short answers on building with AI',
  description:
    'Everything Rhea Karuturi posts on @heyrhai: short answers to the questions companies ask about AI workshops, agents, dashboards and putting AI to work.',
  alternates: { canonical: '/instagram' }
};

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

export default async function InstagramPage() {
  const posts = await getInstagramPosts();

  const jsonLd = posts.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        url: `${SITE}/instagram`,
        name: 'Rhai on Instagram',
        about: { '@id': `${SITE}/#organization` },
        hasPart: posts.map(p => ({
          '@type': 'SocialMediaPosting',
          url: p.permalink,
          datePublished: p.timestamp,
          headline: splitCaption(p.caption).title.slice(0, 110),
          articleBody: p.caption,
          author: { '@type': 'Person', name: 'Rhea Karuturi', url: `${SITE}/about` }
        }))
      }
    : null;

  return (
    <main className="min-h-screen bg-cream text-ink-900">
      <SiteHeader />
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}

      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="eyebrow">Instagram · @heyrhai</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] tracking-tight text-ink-900 sm:text-5xl">
            Short answers, <span className="text-ink-400">posted as they come up.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-700">
            The questions that come up in workshops and client calls, answered in a post. Everything here is from{' '}
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="text-accent underline-offset-4 hover:underline">
              @heyrhai on Instagram
            </a>
            .
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-5xl px-6 py-14">
          {posts.length === 0 ? (
            <p className="text-sm text-ink-600">
              Posts will appear here shortly. In the meantime, find us at{' '}
              <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="text-accent underline-offset-4 hover:underline">
                instagram.com/heyrhai
              </a>
              .
            </p>
          ) : (
            <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map(p => {
                const { title, body } = splitCaption(p.caption);
                return (
                  <article key={p.id}>
                    <a href={p.permalink} target="_blank" rel="noreferrer" className="group block">
                      <div className="relative aspect-square overflow-hidden rounded-xl border border-ink-200 bg-cream-100">
                        {p.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt={title || 'Instagram post from @heyrhai'}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        )}
                        {p.mediaType === 'VIDEO' && (
                          <span className="absolute right-2 top-2 rounded-full bg-ink-900/70 px-2 py-0.5 text-[10px] text-cream">
                            ▶ Reel
                          </span>
                        )}
                      </div>
                    </a>
                    <p className="mt-3 text-[11px] text-ink-400">{fmtDate(p.timestamp)}</p>
                    {title && <h2 className="mt-1 font-display text-lg leading-snug tracking-tight text-ink-900">{title}</h2>}
                    {body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-700">{body}</p>}
                    <a
                      href={p.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-block text-xs text-accent underline-offset-4 hover:underline"
                    >
                      View on Instagram ↗
                    </a>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <InstagramConnect />
      <SiteFooter />
    </main>
  );
}
