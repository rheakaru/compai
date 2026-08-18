'use client';

// The workshops front door at heyrhai.com/workshops — the page Rhea sends to
// anyone who asks "what does a session actually involve, and what does it
// cost." It's the web version of the intro note: who she is, what a session
// is, how dashboards are thought about, the three tiers, and the commercial
// fine print. The module library lives one level down at /workshops/modules.

import Link from 'next/link';
import { CONTACT_EMAIL, SiteFooter, SiteHeader } from './SiteChrome';
import { FINE_PRINT, MODULE_COUNT, TIERS } from '@/lib/site/workshops';

const DASHBOARD_STAGES = [
  { stage: 'Capture', body: 'What the company actually knows, in one place it can be read from.' },
  { stage: 'View', body: 'The screen most companies already have. Reporting on what happened.' },
  { stage: 'Analyse', body: 'Where most dashboards stop — slices, comparisons, a chart someone asked for.' },
  { stage: 'Insight', body: 'The layer that notices. Problems surfaced before anyone thinks to look.' },
  { stage: 'Action', body: 'The dashboard drafts the response. A report becomes an operator.' }
];

export function WorkshopsPage() {
  return (
    <main className="min-h-screen bg-cream text-ink-900">
      <SiteHeader />

      {/* Hero. */}
      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <p className="eyebrow">Workshops · In person · Bangalore &amp; San Francisco</p>
          <h1 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight text-ink-900 sm:text-6xl">
            A workshop,{' '}
            <span className="text-ink-400">not a webinar.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-700 sm:text-xl">
            A room, your team&apos;s own laptops, and a few hours where everyone builds something for their own work by
            the end of it. Nobody is sold software. The output is a thing that runs, and a team that knows why it runs.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#pricing"
              className="rounded-md bg-ink-900 px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink-800"
            >
              See the three formats
            </a>
            <Link
              href="/workshops/modules"
              className="rounded-md border border-ink-300 bg-white/70 px-4 py-2.5 text-sm font-medium text-ink-800 hover:bg-white"
            >
              The module library →
            </Link>
          </div>
        </div>
      </section>

      {/* Proof strip. */}
      <section className="border-b border-ink-200/60 bg-cream-100">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="eyebrow">So far</p>
          <div className="mt-8 grid gap-8 sm:grid-cols-4">
            <div>
              <p className="font-display text-4xl text-ink-900">100+</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                People trained since March, across corporate sessions and the free community.
              </p>
            </div>
            <div>
              <p className="font-display text-4xl text-ink-900">12</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Companies — real estate, aerospace, manufacturing, F&amp;B, healthcare, fintech.
              </p>
            </div>
            <div>
              <p className="font-display text-4xl text-ink-900">{MODULE_COUNT}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Tested modules in the library. Every session is assembled from pieces that already work.
              </p>
            </div>
            <div>
              <p className="font-display text-4xl text-ink-900">1</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Person running every engagement, start to finish. That&apos;s the constraint and the point.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who I am. */}
      <section id="who" className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="eyebrow">Who runs it</p>
              <h2 className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
                Rhea Karuturi.
              </h2>
            </div>
            <div className="space-y-5 text-[15px] leading-relaxed text-ink-700 sm:text-base">
              <p>
                For the last seven years I&apos;ve been co-founder and CTO of Hoovu Fresh, a B2B puja-flower supply
                chain running across nine Indian cities. The AI that runs Hoovu became the operating system the
                business runs on day to day — so most of what I teach is what I&apos;ve already had to build and deploy
                myself, not theory.
              </p>
              <p>
                I studied at Stanford, where I did a B.S. in Science, Technology &amp; Society, and I&apos;ve been on
                Shark Tank India. My background is really in teaching — which is what Rhai is. Since March I&apos;ve run
                AI workshops that have trained over 100 people across 12 companies, plus{' '}
                <Link href="/hang-w-ai" className="text-accent underline-offset-4 hover:underline">
                  Hang w AI
                </Link>
                , a free weekly hands-on community in Bangalore and Hyderabad where a dozen people get in a room and
                actually build something.
              </p>
              <p className="text-ink-900">Every engagement runs through me directly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* The method. */}
      <section className="border-b border-ink-200/60 bg-cream-100">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">The method</p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            Nothing here is written for the first time.
          </h2>
          <div className="mt-10 divide-y divide-ink-200/70 border-y border-ink-200/70">
            {[
              ['Tested modules', 'Each one run in front of a real room and revised after it.'],
              ['Assembled to the audience', 'A founder room and a finance team get different sessions.'],
              ['Customised to the company', 'Your workflows replace our examples.'],
              ['Built live', 'Everyone leaves having made a real thing, not heard about one.']
            ].map(([title, body], i) => (
              <div key={title} className="flex gap-6 py-5">
                <span className="mt-0.5 font-mono text-[11px] text-ink-400">0{i + 1}</span>
                <p className="text-sm leading-relaxed text-ink-700">
                  <strong className="font-medium text-ink-900">{title}</strong> — {body}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-ink-700">
            The full library is public.{' '}
            <Link href="/workshops/modules" className="text-accent underline-offset-4 hover:underline">
              Read all {MODULE_COUNT} modules →
            </Link>
          </p>
        </div>
      </section>

      {/* How we think about dashboards. */}
      <section id="dashboards" className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">The part that&apos;s different</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            A report you read, or an operator that works.
          </h2>
          <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-ink-700 sm:text-base">
            &ldquo;Dashboard&rdquo; is an overloaded word, so it&apos;s worth a minute. A traditional BI dashboard
            reports what happened. An intelligence dashboard reads everything you have, briefs every leader each
            morning, notices problems before they escalate, and drafts the response. Five stages — and most dashboards
            stop at stage three.
          </p>

          <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-ink-200 bg-ink-200 sm:grid-cols-5">
            {DASHBOARD_STAGES.map((s, i) => (
              <li key={s.stage} className={`bg-white p-5 ${i >= 3 ? 'sm:bg-cream-100' : ''}`}>
                <p className="font-mono text-[10px] text-ink-400">STAGE {i + 1}</p>
                <p className="mt-2 font-display text-lg text-ink-900">{s.stage}</p>
                <p className="mt-2 text-xs leading-relaxed text-ink-500">{s.body}</p>
              </li>
            ))}
          </ol>

          <p className="mt-8 max-w-3xl text-[15px] leading-relaxed text-ink-700 sm:text-base">
            The harder half is getting it used. A dashboard is only as good as what people put into it, so we design it
            around one daily headache it solves for each person — that&apos;s the reason they actually open it — and
            their usage feeds the intelligence layer underneath. Deployment happens at the speed of trust, which is why
            we do this in person, on your systems, with a senior person in the room throughout.
          </p>
        </div>
      </section>

      {/* Pricing — three tiers. */}
      <section id="pricing" className="border-b border-ink-200/60 bg-cream-100">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">What it costs</p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            Three formats. Same terms for everyone.
          </h2>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TIERS.map(tier => (
              <article
                key={tier.id}
                className={`flex flex-col rounded-xl border bg-white p-6 ${
                  tier.featured
                    ? 'border-accent/40 shadow-[0_1px_0_rgba(198,74,31,0.08)]'
                    : 'border-ink-200'
                }`}
              >
                <p className="eyebrow text-accent">{tier.name}</p>
                <p className="mt-2 font-display text-3xl tracking-tight text-ink-900">{tier.price}</p>
                <p className="mt-1 text-xs text-ink-500">{tier.shape}</p>
                <p className="mt-3 text-sm leading-relaxed text-ink-700">{tier.blurb}</p>
                <ul className="mt-5 space-y-2 border-t border-ink-200/70 pt-4">
                  {tier.includes.map(item => (
                    <li key={item} className="flex gap-2.5 text-xs leading-relaxed text-ink-600">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          {/* Fine print. */}
          <div className="mt-12 rounded-xl border border-ink-200 bg-white p-6 sm:p-8">
            <p className="eyebrow">The finer print</p>
            <dl className="mt-6 grid gap-6 sm:grid-cols-2">
              {FINE_PRINT.map(item => (
                <div key={item.label}>
                  <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-400">{item.label}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-ink-700">{item.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Contact. */}
      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">Next step</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            Tell me the room.
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-700 sm:text-base">
            Who&apos;s in it, what they do, and the one thing that would make the day worth their time. The session
            gets assembled from there.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Rhai%20workshop`}
              className="rounded-md bg-ink-900 px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink-800"
            >
              {CONTACT_EMAIL}
            </a>
            <Link
              href="/workshops/modules"
              className="rounded-md border border-ink-300 bg-white/70 px-4 py-2.5 text-sm font-medium text-ink-800 hover:bg-white"
            >
              Browse the modules ↓
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
