import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { OPEN_ROLES, roleBySlug } from '@/lib/careers/roles';
import { EDITORIAL_PROSE_CLASS, excerpt, renderMarkdown } from '@/lib/markdown';

const SITE = 'https://heyrhai.com';

export function generateStaticParams() {
  return OPEN_ROLES.map(r => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const role = roleBySlug(slug);
  if (!role) return { title: 'Role not found — Rhai' };
  const description = `${role.tagline} ${role.location}. ${role.salaryLabel}.`.slice(0, 158);
  return {
    title: `${role.title} — Rhai`,
    description,
    alternates: { canonical: `/careers/${role.slug}` },
    openGraph: {
      title: `${role.title} at Rhai`,
      description,
      url: `/careers/${role.slug}`,
      type: 'article'
    },
    twitter: { card: 'summary_large_image', title: `${role.title} at Rhai`, description }
  };
}

export default async function RolePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const role = roleBySlug(slug);
  if (!role) notFound();

  const html = renderMarkdown(role.body);
  const applyUrl = `${SITE}/interview/${role.interviewId}`;

  // JobPosting structured data — gets the role into Google Jobs and gives
  // answer engines a machine-readable version of the same page.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: role.title,
    description: html,
    datePosted: role.datePosted,
    employmentType: role.employmentTypes,
    directApply: true,
    hiringOrganization: {
      '@type': 'Organization',
      name: 'Rhai',
      sameAs: SITE,
      url: SITE
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: role.city,
        addressRegion: role.region,
        addressCountry: 'IN'
      }
    },
    baseSalary: {
      '@type': 'MonetaryAmount',
      currency: 'INR',
      value: { '@type': 'QuantitativeValue', value: role.salaryInr, unitText: 'YEAR' }
    },
    applicantLocationRequirements: { '@type': 'Country', name: 'India' },
    url: `${SITE}/careers/${role.slug}`
  };

  return (
    <main className="min-h-screen bg-cream text-ink-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />

      <article>
        {/* Role header */}
        <header className="border-b border-ink-200/60">
          <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
            <Link href="/careers" className="text-xs text-ink-400 hover:text-ink-700">
              ← All roles
            </Link>
            <p className="eyebrow mt-6">Open role</p>
            <h1 className="mt-3 font-display text-4xl leading-[1.08] tracking-tight text-ink-900 sm:text-5xl">
              {role.title}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-ink-700">{role.tagline}</p>

            <dl className="mt-8 grid gap-4 sm:grid-cols-4">
              <Fact label="Location" value={role.location} />
              <Fact label="Type" value={role.employmentLabel} />
              <Fact label="Compensation" value={role.salaryLabel} />
              <Fact label="Start" value={role.startLabel} />
            </dl>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={`/interview/${role.interviewId}`}
                className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-600"
              >
                Start the first round →
              </a>
              <span className="text-[11px] text-ink-500">
                ~15 minutes with Rhai, by voice or text. Then a conversation with Rhea.
              </span>
            </div>
          </div>
        </header>

        {/* The JD itself */}
        <div className="mx-auto max-w-3xl px-6 py-14">
          <div className={EDITORIAL_PROSE_CLASS} dangerouslySetInnerHTML={{ __html: html }} />
        </div>

        {/* Apply again at the bottom — people decide at the end. */}
        <section className="border-t border-ink-200/60 bg-cream-100">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <p className="eyebrow">Apply</p>
            <h2 className="mt-3 font-display text-3xl tracking-tight text-ink-900">
              The first round is a conversation, not a form.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-700">
              Rhai will ask about where you&apos;re based and the practical things, then spend most of the time on how
              you see people and organisations. Answer by voice if you can — this is a job about talking to people, and
              we listen to how you talk. Rhea reads every transcript herself.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href={`/interview/${role.interviewId}`}
                className="rounded-md bg-ink-900 px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink-800"
              >
                Interview with Rhai →
              </a>
              <Link
                href="/writing"
                className="rounded-md border border-ink-300 bg-white/70 px-5 py-2.5 text-sm font-medium text-ink-800 hover:bg-white"
              >
                See what we build
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-ink-500">
              Share this role: <span className="font-mono text-ink-600">{`${SITE}/careers/${role.slug}`}</span>
            </p>
          </div>
        </section>
      </article>

      <SiteFooter />
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow text-ink-400">{label}</dt>
      <dd className="mt-1 text-sm text-ink-800">{value}</dd>
    </div>
  );
}
