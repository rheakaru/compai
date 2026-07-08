'use client';

// The Rhai company homepage — public front door at heyrhai.com. Positions
// Rhai as an AI practice (not one person), leans on real proof (Hoovu +
// Bliss + Hang w AI), points at the free brand-ontology tool as top-of-
// funnel, and gives a quiet way to start a conversation. Uses the same
// design system as the operator dashboard (cream canvas · Fraunces display ·
// small-caps eyebrows · warm terracotta accent) so heyrhai.com and the
// signed-in app feel like one thing.

import { useAuth } from './AuthProvider';

const MARKETING_TOOL = 'https://compai-marketing.web.app';
const PERSONAL_SITE = 'https://rheakaru.github.io';
const CONTACT_EMAIL = 'rhea@rosebazaar.in';

export function RhaiHome() {
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-cream text-ink-900">
      {/* Minimal top bar — the marketing homepage doesn't need dashboard nav. */}
      <header className="border-b border-ink-200/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <span className="flex items-baseline gap-2 text-ink-900">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
            <span className="font-display text-[17px] font-medium tracking-tight">Rhai</span>
          </span>
          <div className="flex items-center gap-4 text-xs">
            <a href="#work" className="hidden text-ink-500 hover:text-ink-900 sm:inline">Work</a>
            <a href="#tool" className="hidden text-ink-500 hover:text-ink-900 sm:inline">Free tool</a>
            <a href="#contact" className="hidden text-ink-500 hover:text-ink-900 sm:inline">Contact</a>
            <a
              href={user ? '/leads' : '#contact'}
              className="whitespace-nowrap rounded-md border border-ink-300 bg-white/70 px-3 py-1.5 font-medium text-ink-800 hover:bg-white"
            >
              {user ? 'Dashboard →' : 'Start a conversation'}
            </a>
          </div>
        </div>
      </header>

      {/* Hero — one confident line, then the concrete offer. */}
      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <p className="eyebrow">Rhai · An AI practice</p>
          <h1 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight text-ink-900 sm:text-6xl">
            AI that runs inside your business —{' '}
            <span className="text-ink-400">not next to it.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-700 sm:text-xl">
            Two things we do. We teach your team to build with AI on your systems, in a day. And we build the
            intelligence dashboards those teams then run their business on. You own everything from minute one — no
            vendor, no lock-in, no waiting.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#contact"
              className="rounded-md bg-ink-900 px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink-800"
            >
              Start a conversation
            </a>
            <a
              href="#tool"
              className="rounded-md border border-ink-300 bg-white/70 px-4 py-2.5 text-sm font-medium text-ink-800 hover:bg-white"
            >
              Try a tool free ↓
            </a>
          </div>
        </div>
      </section>

      {/* What we do — two panels for the two offers. */}
      <section id="work" className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">What we do</p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            Two tracks, both hands-on.
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <article className="rounded-xl border border-ink-200 bg-white p-6 sm:p-8">
              <p className="eyebrow text-accent">01 · Workshops</p>
              <h3 className="mt-2 font-display text-2xl text-ink-900">Teach your team to build.</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-700">
                A discovery call to understand your operation, then a day building with your team on their machines. By
                the end you have three things: a working prototype for a real problem we scoped together, one person on
                your team who can extend it, and a prioritised list of what to build next.
              </p>
              <p className="mt-4 text-xs leading-relaxed text-ink-500">
                One senior person present throughout — non-negotiable. Runs on your Google or Microsoft tenant, your
                API keys, your data. Nothing to migrate afterwards.
              </p>
            </article>
            <article className="rounded-xl border border-ink-200 bg-white p-6 sm:p-8">
              <p className="eyebrow text-accent">02 · Commissioned builds</p>
              <h3 className="mt-2 font-display text-2xl text-ink-900">
                The dashboard is the company&apos;s interface to itself.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-700">
                We build the intelligence layer your leadership runs the business on. Not BI. Something that reads
                everything you have, briefs every leader every morning, notices problems before they escalate, and
                drafts the response.
              </p>
              <p className="mt-4 text-xs leading-relaxed text-ink-500">
                Five stages: capture, view, analyse, insight, action. Most dashboards stop at stage three. Ours don&apos;t.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Proof — a real line, a real case study, real numbers. */}
      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">A recent build</p>
          <blockquote className="mt-4">
            <p className="font-display text-2xl leading-tight tracking-tight text-ink-900 sm:text-4xl">
              &ldquo;Twenty thousand parts, no single screen to plan them on. We built that screen in an afternoon.&rdquo;
            </p>
          </blockquote>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ink-600">
            <span className="eyebrow mr-2 text-ink-500">Bliss Aerospace</span>Six hours inside their factory, then a
            build day with their planning team on a Microsoft tenant they already owned. They walked out with a
            working scheduler, one person who could extend it, and a punch-list of what to build next. Zero new
            vendors, zero new contracts.
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <div>
              <p className="font-display text-3xl text-ink-900">7 yrs</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Running the AI layer inside Hoovu Fresh — B2B puja-flower supply chain across 9 Indian cities.
              </p>
            </div>
            <div>
              <p className="font-display text-3xl text-ink-900">350+</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Members in Hang w AI — the weekly hands-on community we run for operators and founders in Bangalore
                and Hyderabad.
              </p>
            </div>
            <div>
              <p className="font-display text-3xl text-ink-900">12+</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Companies through our workshops so far — real estate, aerospace, manufacturing, F&amp;B, healthcare,
                fintech.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The free tool — the giveaway + soft lead capture. */}
      <section id="tool" className="border-b border-ink-200/60 bg-cream-100">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">Try one, free</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            Build your brand ontology in 15 minutes.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-700">
            One of the things we build for clients is a{' '}
            <em className="font-display italic">brand ontology</em> — a structured brain of who you are, who you sell
            to, and how you talk. It powers content, calendar, and campaigns for months. You can build yours here for
            free: paste your website, answer a handful of questions, walk away with a JSON file you can hand to any AI
            agent from tomorrow onwards.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-ink-200 bg-white p-4">
              <p className="eyebrow text-ink-400">01</p>
              <p className="mt-1 text-sm font-medium text-ink-900">Onboarding</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                Paste your URL. Our AI CMO scrapes your site and interviews you about the brand.
              </p>
            </div>
            <div className="rounded-lg border border-ink-200 bg-white p-4">
              <p className="eyebrow text-ink-400">02</p>
              <p className="mt-1 text-sm font-medium text-ink-900">Ontology + calendar</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                Personas, buckets, POV, style templates — all editable. Then a month of content, planned in two
                minutes.
              </p>
            </div>
            <div className="rounded-lg border border-ink-200 bg-white p-4">
              <p className="eyebrow text-ink-400">03</p>
              <p className="mt-1 text-sm font-medium text-ink-900">Take it home</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                Export the JSON. Give it to Claude, ChatGPT, or your own team — every future prompt gets sharper.
              </p>
            </div>
          </div>
          <div className="mt-8">
            <a
              href={MARKETING_TOOL}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-600"
            >
              Build yours →
            </a>
            <p className="mt-3 text-[11px] text-ink-500">
              Sign in with Google. Yours to keep, whether we ever work together or not.
            </p>
          </div>
        </div>
      </section>

      {/* How we work — the shape of an engagement, plainly. */}
      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">How we work</p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            Days, not months.
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <div>
              <p className="eyebrow text-accent">Discovery call</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">
                Beforehand, a call to understand your operation and pick the real problem we&apos;ll build against — so
                the day is customised to you and your team.
              </p>
            </div>
            <div>
              <p className="eyebrow text-accent">The session</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">
                Six hours with your team, on your machines and accounts. A morning grounding in what&apos;s possible,
                then a guided build. The prototype leaves the building with you.
              </p>
            </div>
            <div>
              <p className="eyebrow text-accent">After</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">
                You keep everything. We&apos;re on WhatsApp for follow-ups, and there when you want to build the next
                one.
              </p>
            </div>
          </div>

          {/* Pricing — two clear tiers. */}
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-ink-200 bg-white p-6">
              <p className="eyebrow text-accent">Intro session</p>
              <p className="mt-2 font-display text-3xl tracking-tight text-ink-900">₹1,00,000</p>
              <p className="mt-1 text-xs text-ink-500">3 hours · general</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-700">
                A hands-on introduction to building with AI for your team — the fastest way to see what&apos;s
                possible. General, not yet customised to your company.
              </p>
            </div>
            <div className="rounded-xl border border-accent/40 bg-white p-6 shadow-[0_1px_0_rgba(198,74,31,0.08)]">
              <p className="eyebrow text-accent">Company session</p>
              <p className="mt-2 font-display text-3xl tracking-tight text-ink-900">₹3,00,000</p>
              <p className="mt-1 text-xs text-ink-500">One day (6 hours) · customised</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-700">
                A discovery call beforehand, then a full day building against a real problem — fully customised to your
                company and its needs. You leave with a working prototype and someone on your team who can extend it.
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-3xl text-xs leading-relaxed text-ink-500">
            <span className="font-medium text-ink-700">Terms.</span> Same-day payment, no retainers. Bangalore and San
            Francisco only for now — travel billed at cost.
          </p>
        </div>
      </section>

      {/* The thesis — Rhea's manifesto, in her own voice. */}
      <section className="border-b border-ink-200/60 bg-cream-100">
        <div className="mx-auto max-w-3xl px-6 py-24">
          <p className="eyebrow">The thesis</p>
          <blockquote className="mt-4">
            <p className="font-display text-3xl leading-tight tracking-tight text-ink-900 sm:text-4xl">
              &ldquo;The future is here — it&apos;s just unevenly distributed.&rdquo;
            </p>
            <cite className="mt-3 block text-sm not-italic text-ink-500">— William Gibson</cite>
          </blockquote>

          <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-ink-700 sm:text-base">
            <p>
              I feel a little sheepish saying this — like a 21-year-old snake oil salesman fanning the flames of the AI
              hype bubble — but I can&apos;t quite stop, because I believe it&apos;s true. When I watch Fable spin out an
              app for me in a few hours that would have taken months to build a year ago, or take a Waymo across San
              Francisco while the people around me talk about putting data centres in space, I have to admit it: the
              future is here.
            </p>
            <p>
              And when I look at the best Indian businesses — the ones that employ hundreds of people, touch millions of
              lives, are household names in their field — I also have to admit it isn&apos;t evenly distributed. They use
              Claude in a chat window as a slightly better search box, and still balk at building their own tools,
              preferring to wait months for a consultant&apos;s proposal.
            </p>
            <p>
              My sense of what AI can actually deliver comes from Atul Gawande, who writes about medicine. He says the
              frontier is what captures our imagination — but most of what saves lives, what makes the largest impact, is
              the ordinary medicine we&apos;ve already solved. We know how to get most people the best outcomes; the gap
              is deployment. That&apos;s where you can have the largest effect on humanity.
            </p>
            <p>
              Dario Amodei says deployment happens at the speed of trust — and as someone who studied trust for my
              honours thesis (in a technological space: the Aadhaar system), I couldn&apos;t agree more. Trust has always
              been my central value. At Hoovu we knew from day one that our customers&apos; trust was the one thing we
              could never gamble on — the most important asset we built.
            </p>
            <p>
              That&apos;s at the heart of Rhai too. Trust is the reason you work with us; everything else is downstream of
              it. Trust is what lets us collaborate, play with this new technology, and discover the ways it can
              transform (sorry — I had to use one buzzword) your business.
            </p>
          </div>

          <p className="mt-8 font-display text-2xl leading-tight tracking-tight text-ink-900 sm:text-3xl">
            The future is here. Let&apos;s get our hands dirty with it.
          </p>
        </div>
      </section>

      {/* Who's behind Rhai — transparent about it being Rhea's practice. */}
      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">Who&apos;s behind Rhai</p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            The people you actually work with.
          </h2>
          <div className="mt-8 grid gap-8 md:grid-cols-[1.2fr_1fr]">
            <p className="text-sm leading-relaxed text-ink-700">
              Rhai is <strong>Rhea Karuturi&apos;s</strong> AI practice. Rhea has been CTO of Hoovu Fresh — a B2B puja-flower
              supply chain across 9 Indian cities — for seven years; the AI that runs it started as her weekend
              project. She studied at Stanford, teaches AI weekly in Bangalore through the Hang w AI community
              (~350 members), and has been on Shark Tank India. Every engagement she takes on runs through her
              directly — teaching, building, closing.
            </p>
            <div className="text-sm text-ink-600">
              <p className="eyebrow text-ink-400">More on Rhea</p>
              <a
                href={PERSONAL_SITE}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-accent hover:underline"
              >
                rheakaru.github.io ↗
              </a>
              <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                Blog posts, past workshop write-ups, and side projects — Vanaja (vernacular-voice HR), Cahoots
                (goal-tracking with a friend), Chapel (a commonplace book as a graph), and more.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact — a short conversation is the fastest test of fit. */}
      <section id="contact">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <p className="eyebrow">Contact</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            Have a short conversation with Rhai — Rhea replies with something specific.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-700">
            Rhai is Rhea&apos;s AI cofounder. It takes about ten minutes to tell Rhai about you, your business, and
            what you&apos;re thinking about — by voice or text, whichever&apos;s easier. Rhea reads every conversation
            herself and gets back within a working day or two.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/talk"
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-600"
            >
              Start a conversation with Rhai →
            </a>
            <span className="text-[11px] text-ink-500">
              or <a href={MARKETING_TOOL} className="text-accent hover:underline">try the free tool first</a>.
            </span>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-200/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-[11px] text-ink-400">
          <p>Rhai · An AI practice by Rhea Karuturi.</p>
          <p className="flex items-center gap-4">
            <a href={PERSONAL_SITE} target="_blank" rel="noreferrer" className="hover:text-ink-700">
              rheakaru.github.io
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink-700">
              {CONTACT_EMAIL}
            </a>
            <a href="/diagnosis" className="hover:text-ink-700">
              Diagnosis tool
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
