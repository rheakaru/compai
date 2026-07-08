'use client';

// Hang w AI — a proof-of-work write-up for the free weekly community Rhea
// runs in Bangalore and Hyderabad. Sits at heyrhai.com/hang-w-ai. Uses the
// same design system as RhaiHome so the two pages feel like one site.

const CONTACT_EMAIL = 'rhea@rosebazaar.in';
const INTROS_WHATSAPP = 'https://chat.whatsapp.com/BSZLG7tXuZm85IaaaVj7fN';
const PERSONAL_SITE = 'https://rheakaru.github.io';

export function HangWithAI() {
  return (
    <main className="min-h-screen bg-cream text-ink-900">
      {/* Top bar — matches the homepage so the two pages feel like one site. */}
      <header className="border-b border-ink-200/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <a href="/" className="flex items-baseline gap-2 text-ink-900">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
            <span className="font-display text-[17px] font-medium tracking-tight">Rhai</span>
          </a>
          <div className="flex items-center gap-4 text-xs">
            <a href="/#work" className="text-ink-500 hover:text-ink-900">Work</a>
            <a href="/#tool" className="text-ink-500 hover:text-ink-900">Free tool</a>
            <a href="/#contact" className="text-ink-500 hover:text-ink-900">Contact</a>
            <a
              href="#join"
              className="rounded-md border border-ink-300 bg-white/70 px-3 py-1.5 font-medium text-ink-800 hover:bg-white"
            >
              Join a session →
            </a>
          </div>
        </div>
      </header>

      {/* Hero. */}
      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <p className="eyebrow">Community · Free · In person</p>
          <h1 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight text-ink-900 sm:text-6xl">
            Hang w AI.{' '}
            <span className="text-ink-400">
              A room, twelve laptops, three hours, and the newest thing in the world.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-700 sm:text-xl">
            Every week or two, a dozen people get in a room in Bangalore or Hyderabad and actually build something with
            AI. Nothing to sit through. No slides shown at you. Bring your laptop, bring a paid Claude subscription, bring
            a problem from your real work. You leave with a working prototype and a group of people building alongside you.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#join"
              className="rounded-md bg-ink-900 px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink-800"
            >
              How to join
            </a>
            <a
              href="#arc"
              className="rounded-md border border-ink-300 bg-white/70 px-4 py-2.5 text-sm font-medium text-ink-800 hover:bg-white"
            >
              What a session looks like ↓
            </a>
          </div>
        </div>
      </section>

      {/* Stat strip — proof-of-work numbers. */}
      <section className="border-b border-ink-200/60 bg-cream-100">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="eyebrow">The numbers so far</p>
          <div className="mt-8 grid gap-8 sm:grid-cols-4">
            <div>
              <p className="font-display text-4xl text-ink-900">350+</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Members across the intros group. Operators, founders, engineers, students, artists — mostly people who
                run something already.
              </p>
            </div>
            <div>
              <p className="font-display text-4xl text-ink-900">12+</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Sessions run. Each capped at ~12 people so everyone actually builds, not just watches.
              </p>
            </div>
            <div>
              <p className="font-display text-4xl text-ink-900">2 cities</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Bangalore (weekly-ish, Rhea) and Hyderabad (chapter run by Venkat &amp; Anusha). More coming.
              </p>
            </div>
            <div>
              <p className="font-display text-4xl text-ink-900">₹0</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Free. Always has been. You pay for your own Claude subscription and your own coffee.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What a session looks like. */}
      <section id="arc" className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">The shape of a session</p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            Three hours. One arc.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-700">
            Every session has the same skeleton so the room settles into it quickly. The middle third — the build —
            is always the point.
          </p>

          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            <li className="rounded-xl border border-ink-200 bg-white p-6">
              <p className="eyebrow text-accent">Hour 1 · Situate</p>
              <p className="mt-2 font-display text-xl leading-tight text-ink-900">
                Vocabulary, mental models, one live demo.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-700">
                Ten words to make the rest land — LLM, context, agent, harness, MCP, skills. Then one of the big
                frames: how code changed, Dorsey&apos;s question about what your company actually is, the five stages of a
                dashboard. Ending with something real on screen — usually the Hoovu AI CEO briefing itself for the day.
              </p>
            </li>
            <li className="rounded-xl border border-ink-200 bg-white p-6">
              <p className="eyebrow text-accent">Hour 2 · Build</p>
              <p className="mt-2 font-display text-xl leading-tight text-ink-900">
                Pick a real problem. Ship a rough thing.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-700">
                One prompt to Claude Code, a Firebase scaffold if you need a backend, and something on your screen inside
                twenty minutes. Rule: pick a boring problem from actual work, not a demo idea. Boring usually means
                actually used.
              </p>
            </li>
            <li className="rounded-xl border border-ink-200 bg-white p-6">
              <p className="eyebrow text-accent">Hour 3 · Show &amp; tell</p>
              <p className="mt-2 font-display text-xl leading-tight text-ink-900">
                Three minutes each. The broken parts too.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-700">
                The problem → the build → what your tool reveals that wasn&apos;t visible before → what&apos;s next.
                Peer learning does the heavy lifting here. You leave with a group chat that keeps going.
              </p>
            </li>
          </ol>

          <blockquote className="mt-14 border-l-2 border-accent/60 pl-6">
            <p className="font-display text-2xl leading-tight tracking-tight text-ink-900 sm:text-3xl">
              &ldquo;Not too much time on technicalities. Get situated, then get hands dirty.&rdquo;
            </p>
            <cite className="mt-3 block text-xs not-italic text-ink-500">— the operating rule</cite>
          </blockquote>
        </div>
      </section>

      {/* What we've taught. */}
      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">The curriculum so far</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            A menu of modules — mixed and remixed session to session, based on who&apos;s in the room.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-700">
            Every session, a day beforehand, people share what they&apos;re excited to learn or build. The core is
            always the same; one module gets swapped in to match the group. Nothing is a lecture — each one lands in
            a demo or a build exercise.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                tag: 'Core',
                title: 'AI 101 + vocabulary',
                body: 'Ten words that make the rest land. LLMs, context windows, agents, harness, MCP, skills, connectors.'
              },
              {
                tag: 'Core',
                title: 'How code changed',
                body: 'Structure → reasoning. Karpathy&apos;s Software 1/2/3. The MenuGen one-year story. Why the question changed from "what&apos;s the data?" to "what action am I taking?"'
              },
              {
                tag: 'Core',
                title: 'Dorsey — companies in the AI age',
                body: 'The 2,000-year question of coordinating thousands of people. World model + customer signal. The four layers. What your company actually is when you strip the scaffolding out.'
              },
              {
                tag: 'Core',
                title: 'Dashboards, five stages',
                body: 'Input → View → Analyze → Insight → Action. Most companies stop at stage three. The new shape of work lives in four and five.'
              },
              {
                tag: 'Demo',
                title: 'Hoovu live walkthrough',
                body: 'Tab-switch through the five stages on a real seven-year-old B2B business. Then the executive agents — AI CEO, CFO, CMO — briefing the room live.'
              },
              {
                tag: 'Build',
                title: 'Firebase scaffold in ten minutes',
                body: 'Console → Blaze → Firestore → Google auth → one prompt to Claude Code. React + Vite + Express on Cloud Functions. Everyone leaves with a working app on their own tenant.'
              },
              {
                tag: 'Special',
                title: 'Voice agents',
                body: 'Reading is a tax. Typing is a tax. Speaking is free. STT → LLM → TTS as three swappable pieces. Sarvam vs Whisper vs Deepgram. Why voice is the front door for the next billion.'
              },
              {
                tag: 'Special',
                title: 'Marketing / brand ontology',
                body: 'Stop thinking about content, start thinking about the system that produces content. Seven-step ontology builder. From free-write to a JSON your team can plug into any tool.'
              },
              {
                tag: 'Special',
                title: 'Second brain (Obsidian + MCP)',
                body: 'Your notes as a graph an agent can walk. The flatter your data, the dumber your agent gets — so we structure it before we point Claude at it.'
              },
              {
                tag: 'Special',
                title: 'Context graphs (Neo4j)',
                body: 'When flat data isn&apos;t enough. Modeling a business as a graph — people, orders, locations, events — so agents can reason across relationships instead of columns.'
              },
              {
                tag: 'Special',
                title: 'Personal OS',
                body: 'Skills, connectors, memory, calendar and inbox as MCP servers, a daily briefing that reads your life the way Hoovu&apos;s AI CEO reads a business.'
              },
              {
                tag: 'Always',
                title: 'Show &amp; tell',
                body: 'Three minutes each. Demo the broken parts. What does your tool reveal that wasn&apos;t visible before?'
              }
            ].map((m) => (
              <article key={m.title} className="rounded-lg border border-ink-200 bg-white p-5">
                <p className="eyebrow text-accent">{m.tag}</p>
                <h3 className="mt-1 font-display text-lg leading-tight text-ink-900" dangerouslySetInnerHTML={{ __html: m.title }} />
                <p className="mt-2 text-[13px] leading-relaxed text-ink-600" dangerouslySetInnerHTML={{ __html: m.body }} />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* What people build. */}
      <section className="border-b border-ink-200/60 bg-cream-100">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">What people build</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            The rule is: pick something boring from your actual week.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-700">
            No demo ideas, no toy projects. The build session works because everyone points AI at a real thing they
            already do — the shape of what comes out surprises them almost every time.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-ink-200 bg-white p-6">
              <p className="eyebrow text-ink-400">Session opener · Ep. 3</p>
              <p className="mt-2 font-display text-xl leading-tight text-ink-900">
                Ten pairs shipped ten coffee-ordering apps in an hour. The winning app&apos;s order is what the room
                drank.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">
                Build first, theory after. By the time the paradigm-shift teaching lands, everyone in the room has
                lived the paradigm shift themselves. Ten apps that didn&apos;t exist an hour ago.
              </p>
            </div>
            <div className="rounded-xl border border-ink-200 bg-white p-6">
              <p className="eyebrow text-ink-400">A recurring pattern</p>
              <p className="mt-2 font-display text-xl leading-tight text-ink-900">
                &ldquo;It&apos;s a spreadsheet I update every Monday.&rdquo;
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">
                The most common show-and-tell is someone who replaced a weekly ritual — a report, a status update, a
                content calendar, a shortlist — with a small dashboard that does it in one prompt. Not glamorous. Very
                used.
              </p>
            </div>
          </div>

          <p className="mt-10 max-w-3xl text-sm leading-relaxed text-ink-700">
            People have built voice HR assistants in Kannada and Telugu, personal knowledge graphs of every book and
            film they&apos;ve loved, two-person goal trackers with an agent that knows both people&apos;s context,
            attention-respecting news apps, mandi-price intelligence tools, and a lot of internal dashboards that
            replaced whatever they were doing in Google Sheets. The bar isn&apos;t &ldquo;impressive.&rdquo; It&apos;s
            &ldquo;this compresses something I actually do.&rdquo;
          </p>
        </div>
      </section>

      {/* Prereqs. */}
      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">Before you show up</p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            Four things on your laptop. That&apos;s the whole prerequisite.
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: '01', t: 'Claude Desktop', b: 'Download the Claude desktop app.' },
              {
                n: '02',
                t: 'Paid Claude plan',
                b: 'Pro minimum — you need Claude Code, which the free plan doesn&apos;t include.'
              },
              { n: '03', t: 'A GitHub account', b: 'Not required to start, but a mark of honour once you do.' },
              {
                n: '04',
                t: 'GitHub connected to Claude Code',
                b: 'Sign in inside Claude Code so it can push and pull for you.'
              }
            ].map((p) => (
              <li key={p.n} className="rounded-lg border border-ink-200 bg-white p-5">
                <p className="eyebrow text-ink-400">{p.n}</p>
                <p className="mt-1 font-display text-lg text-ink-900" dangerouslySetInnerHTML={{ __html: p.t }} />
                <p className="mt-2 text-[13px] leading-relaxed text-ink-600" dangerouslySetInnerHTML={{ __html: p.b }} />
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-2xl text-xs leading-relaxed text-ink-500">
            Stuck on any of them? Ask Claude what to do next, screenshot where it goes wrong, or give the Chrome
            extension access to your browser and let it do it for you. If you&apos;re still stuck, ping the group.
          </p>
        </div>
      </section>

      {/* Readings. */}
      <section className="border-b border-ink-200/60 bg-cream-100">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">What we send you home with</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            The reading list.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-700">
            Rhea sends these after every session. They&apos;re the intellectual scaffolding for what we&apos;re doing
            in the room — the arguments about hierarchy and intelligence, about deployment vs. frontier, about vibe
            coding and verifiability, about why the future is here and unevenly distributed.
          </p>

          <ul className="mt-10 divide-y divide-ink-200 border-y border-ink-200 bg-white">
            {[
              {
                a: 'Jack Dorsey',
                t: 'From hierarchy to intelligence',
                u: 'https://block.xyz/inside/from-hierarchy-to-intelligence',
                n: 'The essay behind our companies-and-moats block. What a company actually is when AI is the coordination layer.'
              },
              {
                a: 'Wired',
                t: 'The rise of the no-code startup (2020)',
                u: 'https://www.wired.com/story/new-startup-no-code-no-problem',
                n: '&ldquo;Silicon Valley&apos;s main trick is just shoving things into a database and pulling them out again.&rdquo;'
              },
              {
                a: 'Andrej Karpathy',
                t: 'Software 3.0 — the vibe coding talk',
                u: 'https://www.youtube.com/watch?v=96jN2OCOfLs',
                n: 'The hottest new programming language is English. Fifty minutes; watch the whole thing.'
              },
              {
                a: 'Andrej Karpathy',
                t: 'On verifiability',
                u: 'https://karpathy.bearblog.dev/verifiability/',
                n: 'Why some tasks compound with AI and some don&apos;t. Read alongside anything you&apos;re thinking of building.'
              },
              {
                a: 'Atul Gawande',
                t: 'Why doctors hate their computers',
                u: 'https://www.newyorker.com/magazine/2018/11/12/why-doctors-hate-their-computers',
                n: 'The most important essay on what happens when tools are designed for institutions instead of the people using them.'
              },
              {
                a: 'Atul Gawande',
                t: 'The heroism of incremental care',
                u: 'https://www.newyorker.com/magazine/2017/01/23/the-heroism-of-incremental-care',
                n: 'Application beats frontier. The Gawande argument that anchors the whole practice.'
              },
              {
                a: 'William Gibson',
                t: 'The future is already here',
                u: 'https://interactions.acm.org/archive/view/march-april-2017/the-future-is-already-here',
                n: 'The epigraph of Rhai. Also, of every session.'
              },
              {
                a: 'Anthropic',
                t: 'claude101.com + the org deployment PDF',
                u: 'https://claude101.com',
                n: 'For self-study before or after — especially if you couldn&apos;t make it in person.'
              }
            ].map((r) => (
              <li key={r.t} className="grid gap-3 px-6 py-5 sm:grid-cols-[1fr_2fr] sm:items-baseline">
                <div>
                  <p className="eyebrow text-ink-400">{r.a}</p>
                  <a
                    href={r.u}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block font-display text-lg leading-tight text-ink-900 hover:text-accent"
                  >
                    {r.t} ↗
                  </a>
                </div>
                <p className="text-[13px] leading-relaxed text-ink-600" dangerouslySetInnerHTML={{ __html: r.n }} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Why in person. */}
      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-3xl px-6 py-24">
          <p className="eyebrow">Why in person</p>
          <blockquote className="mt-4">
            <p className="font-display text-3xl leading-tight tracking-tight text-ink-900 sm:text-4xl">
              &ldquo;Showing up physically is often the most important part.&rdquo;
            </p>
          </blockquote>

          <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-ink-700 sm:text-base">
            <p>
              Hang w AI is strictly in person. There are no online sessions and there won&apos;t be. This is on
              purpose. Learning to build with AI is not an information problem — the information is already
              everywhere. It&apos;s a friction problem. Whether you get past the first few moments of &ldquo;wait, what
              do I even ask it&rdquo; and into the loop where the agent teaches you.
            </p>
            <p>
              The loop happens faster when someone next to you says &ldquo;wait, try this&rdquo; and when you can turn
              your laptop around and go &ldquo;is this weird?&rdquo; It happens faster when three other people in the
              room are on Claude Code at the same time as you and one of them has already solved the exact thing
              you&apos;re stuck on. It doesn&apos;t happen on Zoom.
            </p>
            <p>
              We&apos;ve run twelve of these now. Every single time the room has fully changed the shape of what people
              thought was possible for their work — often quietly, in some show-and-tell where someone says &ldquo;I
              built the tool I&apos;ve been asking IT for for two years, in ninety minutes, and it&apos;s better than
              the one they were going to ship.&rdquo;
            </p>
            <p>
              That&apos;s the whole reason this exists. Trust deploys at the speed of proximity. So we sit in a room
              together.
            </p>
          </div>

          <p className="mt-8 font-display text-2xl leading-tight tracking-tight text-ink-900 sm:text-3xl">
            The gap between people who use this and people who don&apos;t is widening every week. Be in the room.
          </p>
        </div>
      </section>

      {/* Join. */}
      <section id="join" className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">How to join</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
            One WhatsApp group, one poll, one Saturday afternoon.
          </h2>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-ink-200 bg-white p-6">
              <p className="eyebrow text-accent">Step 1</p>
              <p className="mt-2 font-display text-xl leading-tight text-ink-900">Join the intros group.</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-700">
                This is the main channel — 350+ operators, founders, and builders across Bangalore, Hyderabad, and
                further. Every upcoming session gets announced here with a poll about a week in advance.
              </p>
            </div>
            <div className="rounded-xl border border-ink-200 bg-white p-6">
              <p className="eyebrow text-accent">Step 2</p>
              <p className="mt-2 font-display text-xl leading-tight text-ink-900">Vote on the poll.</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-700">
                Sessions cap at twelve. First twelve to commit are in — you get added to an event-specific group with
                the host, address, and time. Repeat attendees will be gently pushed to the back of the line so new
                folks can come in.
              </p>
            </div>
            <div className="rounded-xl border border-ink-200 bg-white p-6">
              <p className="eyebrow text-accent">Step 3</p>
              <p className="mt-2 font-display text-xl leading-tight text-ink-900">Show up. On time. With coffee order.</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-700">
                We have a hard stop, so we start on time. Drop your drink of choice in the group an hour before — the
                host does one big order. Flaking will be heavily frowned upon 🌝.
              </p>
            </div>
          </div>

          <div className="mt-12 rounded-xl border border-accent/40 bg-white p-6 sm:p-8">
            <p className="eyebrow text-accent">Join the intros group</p>
            <p className="mt-2 font-display text-2xl leading-tight text-ink-900">
              One WhatsApp group. Every future session gets announced there.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-700">
              This is the main channel — join and stay. Sessions are announced with a poll a week in advance;
              first twelve to commit are in. If you can&apos;t find your feet in the group, or you want to bring your
              company through the paid version instead, email Rhea directly.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href={INTROS_WHATSAPP}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-600"
              >
                Join on WhatsApp →
              </a>
              <span className="text-[11px] text-ink-500">
                or{' '}
                <a href="/talk" className="text-accent hover:underline">
                  start a conversation with Rhai first
                </a>
                .
              </span>
            </div>
          </div>

          {/* The paid tier — soft mention, in Rhea's voice. */}
          <p className="mt-10 max-w-3xl text-xs leading-relaxed text-ink-500">
            <span className="font-medium text-ink-700">If you want this for your company:</span> Hang w AI is free
            and community-run. The paid version — one full day of this, customised to your business, with your team
            on your machines — is what Rhai does as its main work. Details on the{' '}
            <a href="/#work" className="text-accent hover:underline">
              Work
            </a>{' '}
            section of the homepage, or on the{' '}
            <a href="https://rheakaru.github.io/sessions.html" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              sessions page
            </a>
            .
          </p>
        </div>
      </section>

      <footer className="border-t border-ink-200/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-[11px] text-ink-400">
          <p>Hang w AI · Free · In person · Bangalore + Hyderabad.</p>
          <p className="flex items-center gap-4">
            <a href="/" className="hover:text-ink-700">
              heyrhai.com
            </a>
            <a href={PERSONAL_SITE} target="_blank" rel="noreferrer" className="hover:text-ink-700">
              rheakaru.github.io
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink-700">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
