import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { OPEN_ROLES } from '@/lib/careers/roles';

export const metadata: Metadata = {
  title: 'Careers at Rhai — work on AI deployment inside Indian companies',
  description:
    'Open roles at Rhai, an AI consulting practice in Bangalore. We hire anthropologists before engineers — because deployment happens at the speed of trust.',
  alternates: { canonical: '/careers' },
  openGraph: {
    title: 'Careers at Rhai',
    description:
      'Open roles at Rhai, an AI consulting practice in Bangalore. We hire anthropologists before engineers.',
    url: '/careers',
    type: 'website'
  }
};

export default function CareersPage() {
  return (
    <main className="min-h-screen bg-cream text-ink-900">
      <SiteHeader />

      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
          <p className="eyebrow">Careers</p>
          <h1 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight text-ink-900 sm:text-5xl">
            We hire anthropologists <span className="text-ink-400">before engineers.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-ink-700">
            Rhai helps Indian companies deploy AI — through workshops, custom builds, and the intelligence
            dashboards leadership runs the business on. None of it works without trust, and trust is built by
            people who can walk into a company and see it clearly.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-6 py-16">
          <p className="eyebrow">Open roles · {OPEN_ROLES.length}</p>
          <div className="mt-6 space-y-4">
            {OPEN_ROLES.map(role => (
              <Link
                key={role.slug}
                href={`/careers/${role.slug}`}
                className="block rounded-xl border border-ink-200 bg-white p-6 transition-colors hover:border-accent/50 sm:p-8"
              >
                <h2 className="font-display text-2xl tracking-tight text-ink-900">{role.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-700">{role.tagline}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-ink-500">
                  <span className="rounded-full border border-ink-200 bg-cream-50 px-2.5 py-1">{role.location}</span>
                  <span className="rounded-full border border-ink-200 bg-cream-50 px-2.5 py-1">
                    {role.employmentLabel}
                  </span>
                  <span className="rounded-full border border-ink-200 bg-cream-50 px-2.5 py-1">
                    {role.salaryLabel}
                  </span>
                  <span className="rounded-full border border-ink-200 bg-cream-50 px-2.5 py-1">
                    Start: {role.startLabel}
                  </span>
                </div>
                <p className="mt-5 text-sm font-medium text-accent">Read the full description →</p>
              </Link>
            ))}
          </div>

          <p className="mt-10 text-sm leading-relaxed text-ink-600">
            Nothing here that fits? We read everything sent to{' '}
            <a href="mailto:rhea@rosebazaar.in" className="text-accent hover:underline">
              rhea@rosebazaar.in
            </a>{' '}
            — tell us what you&apos;d want to work on. It also helps to come to a{' '}
            <Link href="/hang-w-ai" className="text-accent hover:underline">
              Hang w AI
            </Link>{' '}
            session first; most people we work with, we met in a room.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
