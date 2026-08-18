'use client';

// The AI Sessions module library at heyrhai.com/workshops/modules — the web
// version of the modules deck. Every session is assembled from these pieces,
// so publishing the whole library is the argument: nothing is written for the
// first time in your room. Reads as a browsable catalogue rather than a
// slide-by-slide port of the PDF.

import Link from 'next/link';
import { CONTACT_EMAIL, SiteFooter, SiteHeader } from './SiteChrome';
import { MODULE_COUNT, MODULE_SECTIONS, SESSION_SHAPES, TIERS } from '@/lib/site/workshops';

export function WorkshopModules() {
  return (
    <main className="min-h-screen bg-cream text-ink-900">
      <SiteHeader />

      {/* Hero. */}
      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-28">
          <p className="eyebrow">The AI Sessions · {MODULE_COUNT} modules · 60 min — 2 days</p>
          <h1 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight text-ink-900 sm:text-6xl">
            Every session,{' '}
            <span className="text-ink-400">built from pieces that already work.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-700 sm:text-xl">
            This is the whole library. Each module has been run in front of a real room and revised after it. A session
            is assembled from these to fit the people in front of me — a founder room and a finance team get different
            days out of the same catalogue.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/workshops#pricing"
              className="rounded-md bg-ink-900 px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink-800"
            >
              Formats &amp; pricing
            </Link>
            <a
              href="#shapes"
              className="rounded-md border border-ink-300 bg-white/70 px-4 py-2.5 text-sm font-medium text-ink-800 hover:bg-white"
            >
              Common session shapes ↓
            </a>
          </div>
        </div>
      </section>

      {/* Section index. */}
      <section className="border-b border-ink-200/60 bg-cream-100">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="eyebrow">Five kinds of module</p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {MODULE_SECTIONS.map(section => (
              <a key={section.id} href={`#${section.id}`} className="group border-t border-ink-900 pt-3">
                <p className="font-mono text-[10px] text-ink-400">§ {section.number}</p>
                <p className="mt-1 font-display text-lg text-ink-900 group-hover:text-accent">{section.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">{section.tagline}</p>
                <p className="mt-2 font-mono text-[10px] text-ink-400">{section.modules.length} modules</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* The library. */}
      {MODULE_SECTIONS.map(section => (
        <section key={section.id} id={section.id} className="scroll-mt-16 border-b border-ink-200/60">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <p className="eyebrow">
              § {section.number} — {section.name}
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">{section.tagline}</h2>
            <p className="mt-4 max-w-2xl text-[15px] italic leading-relaxed text-ink-500">{section.intro}</p>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {section.modules.map(mod => (
                <article key={mod.title} className="flex flex-col rounded-xl border border-ink-200 bg-white p-6">
                  <div className="flex items-start justify-between gap-4 border-b border-ink-200/70 pb-3">
                    <p className="font-mono text-[11px] uppercase tracking-wider text-ink-900">{mod.title}</p>
                    <p className="shrink-0 rounded border border-ink-300 px-1.5 py-0.5 font-mono text-[10px] text-ink-500">
                      {mod.duration}
                    </p>
                  </div>
                  <h3 className="mt-4 font-display text-xl leading-snug tracking-tight text-ink-900">
                    {mod.headline}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-700">{mod.body}</p>
                  <p className="mt-auto pt-5 text-xs leading-relaxed text-ink-500">
                    <span className="font-mono uppercase tracking-wider text-ink-400">Best for</span>
                    <br />
                    <span className="italic">{mod.bestFor}</span>
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Session shapes. */}
      <section id="shapes" className="scroll-mt-16 border-b border-ink-200/60 bg-cream-100">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">Common session shapes</p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            Same pieces. Different days.
          </h2>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-ink-900">
                  <th className="pb-2 font-mono text-[10px] font-normal uppercase tracking-wider text-ink-400">
                    Session
                  </th>
                  <th className="pb-2 font-mono text-[10px] font-normal uppercase tracking-wider text-ink-400">
                    What it&apos;s built from
                  </th>
                </tr>
              </thead>
              <tbody>
                {SESSION_SHAPES.map(row => (
                  <tr key={row.shape} className="border-b border-ink-200/70">
                    <td className="py-4 pr-6 align-top font-mono text-sm text-ink-900">{row.shape}</td>
                    <td className="py-4 align-top text-sm leading-relaxed text-ink-700">{row.builtFrom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-ink-500">
            The three-hour intro is the{' '}
            <Link href="/workshops#pricing" className="text-accent underline-offset-4 hover:underline">
              {TIERS[0].price} format
            </Link>
            . The six-hour customised day is {TIERS[1].price}, or {TIERS[2].price} with a demo dashboard built for your
            company beforehand.
          </p>
        </div>
      </section>

      {/* Close. */}
      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">To build a session</p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">Tell me the room.</h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-700 sm:text-base">
            Who&apos;s in it, what they do, and how long you have. I&apos;ll come back with the modules I&apos;d run
            and why.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Rhai%20workshop%20—%20the%20room`}
              className="rounded-md bg-ink-900 px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink-800"
            >
              {CONTACT_EMAIL}
            </a>
            <Link
              href="/workshops"
              className="rounded-md border border-ink-300 bg-white/70 px-4 py-2.5 text-sm font-medium text-ink-800 hover:bg-white"
            >
              ← Back to workshops
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
