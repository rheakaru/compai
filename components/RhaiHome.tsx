'use client';

// The Rhai company homepage — public front door at heyrhai.com. Positions
// Rhai as an AI practice (not one person), leans on real proof (Hoovu +
// Bliss + Hang w AI), points at the free brand-ontology tool as top-of-
// funnel, and gives a quiet way to start a conversation. Uses the same
// design system as the operator dashboard (cream canvas · Fraunces display ·
// small-caps eyebrows · warm terracotta accent) so heyrhai.com and the
// signed-in app feel like one thing.

import { INSTAGRAM_URL, InstagramGlyph, PERSONAL_SITE, SiteFooter, SiteHeader } from './SiteChrome';
import { VoiceWall } from './VoiceWall';
import { FAQS } from '@/lib/site/faq';
import { MODULE_COUNT, TIERS } from '@/lib/site/workshops';

const MARKETING_TOOL = 'https://compai-marketing.web.app';

export function RhaiHome() {
  return (
    <main className="min-h-screen bg-cream text-ink-900">
      <SiteHeader />

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
                the end you have three things: hands-on work against a real problem we scoped together, people on your
                team who know how to keep going, and a prioritised list of what to build next.
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
                Members in <a href="/hang-w-ai" className="text-accent hover:underline">Hang w AI</a> — the weekly
                hands-on community we run for operators and founders in Bangalore and Hyderabad.
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

      {/* Hang w AI — the community. Top of funnel, and the most visible proof
          that we do this in public every week. */}
      <section id="hang" className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">Community · Free · In person</p>
          <div className="mt-3 grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-end">
            <h2 className="font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
              We do this in public every week.{' '}
              <span className="text-ink-400">A room, twelve laptops, three hours.</span>
            </h2>
            <p className="text-sm leading-relaxed text-ink-700">
              <strong>Hang w AI</strong> is the free community version of the workshop. Every week or two, a dozen
              people get in a room in Bangalore or Hyderabad and actually build something with AI. It&apos;s where most
              of our work starts a conversation.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-4">
            <div className="rounded-lg border border-ink-200 bg-white p-5">
              <p className="font-display text-3xl text-ink-900">350+</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">Members in the intros group</p>
            </div>
            <div className="rounded-lg border border-ink-200 bg-white p-5">
              <p className="font-display text-3xl text-ink-900">12+</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">Sessions run · capped at ~12 each</p>
            </div>
            <div className="rounded-lg border border-ink-200 bg-white p-5">
              <p className="font-display text-3xl text-ink-900">2 cities</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">Bangalore + Hyderabad · more coming</p>
            </div>
            <div className="rounded-lg border border-ink-200 bg-white p-5">
              <p className="font-display text-3xl text-ink-900">₹0</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">Always free · you pay for your own Claude</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/hang-w-ai"
              className="rounded-md bg-ink-900 px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink-800"
            >
              What Hang w AI is →
            </a>
            <a
              href="https://chat.whatsapp.com/BSZLG7tXuZm85IaaaVj7fN"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-ink-300 bg-white/70 px-4 py-2.5 text-sm font-medium text-ink-800 hover:bg-white"
            >
              Join the WhatsApp group ↗
            </a>
          </div>
        </div>
      </section>

      {/* Voice testimonials — renders only if Rhea has approved any. */}
      <VoiceWall />

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

      {/* Rhai Interviews — the hiring product. */}
      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">A tool for hiring</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            Rhai Interviews — every applicant interviewed, ranked before you wake up.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-700">
            Upload a job description and Rhai designs a structured first-round interview with you — you edit every
            question. Share one link; every candidate gets a real, consistent interview any time of day, and you get
            transcripts summarised, scored, and ranked for fit. It&apos;s how we screen our own hires.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="/hire"
              className="inline-flex items-center gap-2 rounded-md bg-ink-900 px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink-800"
            >
              Try it — first job free →
            </a>
            <a
              href="/hire/how-it-works"
              className="inline-flex items-center gap-2 rounded-md border border-ink-300 bg-white/70 px-5 py-2.5 text-sm font-medium text-ink-800 hover:bg-white"
            >
              How it works
            </a>
            <span className="text-[11px] text-ink-500">Then ₹1,000 per role · pay only when applications flow.</span>
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
                then a guided build. Whatever gets made that day stays with you.
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

          {/* Pricing — three tiers, from the shared workshop source of truth. */}
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TIERS.map(tier => (
              <div
                key={tier.id}
                className={`rounded-xl border bg-white p-6 ${
                  tier.featured ? 'border-accent/40 shadow-[0_1px_0_rgba(198,74,31,0.08)]' : 'border-ink-200'
                }`}
              >
                <p className="eyebrow text-accent">{tier.name}</p>
                <p className="mt-2 font-display text-3xl tracking-tight text-ink-900">{tier.price}</p>
                <p className="mt-1 text-xs text-ink-500">{tier.shape}</p>
                <p className="mt-3 text-sm leading-relaxed text-ink-700">{tier.blurb}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-xs leading-relaxed text-ink-500">
            <span className="font-medium text-ink-700">Terms.</span> No retainers. An invoice for the discovery is
            shared before the session as an advance — 30% is the standard — and the balance is payable within 7 days of
            the workshop. Bangalore and San Francisco are home; anywhere else, travel and stay are covered by the
            company.
          </p>
          <p className="mt-4 text-sm text-ink-700">
            <a href="/workshops" className="text-accent underline-offset-4 hover:underline">
              The full workshop page →
            </a>{' '}
            <span className="text-ink-400">·</span>{' '}
            <a href="/workshops/modules" className="text-accent underline-offset-4 hover:underline">
              All {MODULE_COUNT} modules →
            </a>
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
              project. She studied at Stanford, teaches AI weekly in Bangalore through the{' '}
              <a href="/hang-w-ai" className="text-accent hover:underline">Hang w AI</a> community (~350 members), and has been on Shark Tank India. Every engagement she takes on runs through her
              directly — teaching, building, closing.
            </p>
            <div className="text-sm text-ink-600">
              <p className="eyebrow text-ink-400">More on Rhea</p>
              <a
                href="/writing"
                className="mt-2 inline-flex items-center gap-1 text-accent hover:underline"
              >
                Read the build logs →
              </a>
              <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                Write-ups of everything we&apos;ve shipped — the Hoovu dashboard (an AI-run operating system for a
                flower supply chain), Vanaja (vernacular-voice HR), the AI CMO, and more. Also on{' '}
                <a href={PERSONAL_SITE} target="_blank" rel="noreferrer" className="text-ink-600 hover:text-accent">
                  rheakaru.github.io ↗
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Writing — the build-log archive. Real depth for readers, and the
          substance search + answer engines actually index. */}
      <section id="writing" className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">Writing</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            Build logs, not thought leadership.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-700">
            Every write-up is something we actually built and shipped — including the parts that didn&apos;t work.
            An AI-run operating system for a flower supply chain across nine cities. Agents that live inside
            dashboards. A vernacular voice HR partner. A diagnosis tool that refuses to fake completeness.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="/writing"
              className="rounded-md bg-ink-900 px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink-800"
            >
              Read the write-ups →
            </a>
            <a
              href="/careers"
              className="rounded-md border border-ink-300 bg-white/70 px-5 py-2.5 text-sm font-medium text-ink-800 hover:bg-white"
            >
              We&apos;re hiring
            </a>
          </div>
        </div>
      </section>

      {/* FAQ — visible answers that mirror the FAQPage structured data on this
          route, so assistants quoting us are quoting something a human can see. */}
      <section id="faq" className="border-b border-ink-200/60">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <p className="eyebrow">Common questions</p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            The things people ask first.
          </h2>
          <dl className="mt-10 space-y-8">
            {FAQS.map(faq => (
              <div key={faq.q}>
                <dt className="font-display text-lg text-ink-900">{faq.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-ink-700">{faq.a}</dd>
              </div>
            ))}
          </dl>
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
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-ink-300 bg-white/70 px-5 py-2.5 text-sm font-medium text-ink-800 hover:bg-white"
            >
              <InstagramGlyph className="h-4 w-4" />
              Follow @heyrhai
            </a>
            <span className="text-[11px] text-ink-500">
              or <a href={MARKETING_TOOL} className="text-accent hover:underline">try the free tool first</a>.
            </span>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
