---
title: Building the Hoovu Dashboard — an AI-run operating system for a flower supply chain
dek: One dashboard that runs a flower supply chain — an AI CEO, an AI CFO, an AI CMO, predictive flower pricing, and meetings that turn into tasks.
tags: hoovu, dashboard, ai, supply-chain, firebase, claude
source: https://rheakaru.github.io/projects/hoovu-dashboard.html
---

## One dashboard that *runs* a flower supply chain.

Hoovu Fresh moves fresh puja flowers across nine Indian cities every single day — from the Bangalore flower market at dawn to a packet on a quick-commerce shelf by morning. I built the in-house dashboard that runs the whole operation: sales, procurement, packing, logistics, invoicing and cash — wrapped in three AI executives — an **AI CEO**, an **AI CFO** and an **AI CMO** — that brief the team daily, predict flower prices, plan the marketing calendar, and turn every meeting into tasks.

Built and designed in-house by **Rhea Karuturi**, CTO & co-founder, Hoovu Fresh.

- 9 — Cities
- 7 yrs — History in every decision
- 11 — AI memory categories
- 3 — AI executives
- 30 min — Anomaly scan cadence

## The AI CEO, walked through

A short walkthrough of the AI CEO in action — the morning briefing, the proactive nudges, and how it reasons on live data across the operation.

## 01 — The product: What the dashboard does

Below is the actual guided tour built into the dashboard — the route a new team member walks the first time they log in. It doubles as the clearest map of everything the system covers, from the three AI executives down to a single dispatch chip.

### The intelligence layer

- **Meet the AI CEO** — A fresh briefing every morning, grounded in last night's data — what's on track, what needs attention, and the one action attached to each gap.
- **…and the AI CFO** — A second intelligence focused entirely on cash. Flags this week's peak shortfall, working-capital needs and payment-cycle risk — every morning.
- **…and the AI CMO** — A third intelligence for marketing. Turns the Hindu calendar into a daily publishing rhythm — composing posts from a deep brand ontology and generating the hero images itself.
- **Ask it anything** — Open a chat console. Real questions, real answers — every number backed by live data through a tool-use loop.
- **Always watching** — Every 30 minutes the AI scans for threshold breaches across cities, clients and cashflow.
- **Nudges → emails → tasks** — Observations become action: nudges in chat, items in the briefing emails, and tasks added straight to the dashboard.
- **Company context graph** — A graph that knows who reports to whom, our customers and our products — the foundation the AI reasons on.
- **AI memory grows every night** — Eleven categories — clients, cities, flowers, cashflow, festivals, labour and more — re-seeded nightly. Smarter every day.

### The operation

- **One dashboard, every operation** — Sales, ops, invoicing, barcoding, logistics and payments — captured in one place, in seconds.
- **Sales on its own metrics** — A city × client matrix. Coverage gaps surface automatically — missing cities, large drops, anomalies.
- **Procurement, fully instrumented** — Buy plans, farmer quality notes and price bands, all in one place.
- **Forecast prices before you buy** — Flower-price prediction baked in. Buy smarter, not harder.
- **Accounts has its own cockpit** — Receivables, payables and daily checklists — and one-button push of payments and bills to Zoho Books.
- **Live cashflow, always on** — Bank balances, recurring payments and ad-hoc dues — refreshed live.

### The people

- **Where human intelligence shines** — An HR cockpit — attendance, payroll, performance and growth, for warehouse workers and office staff alike.
- **Performance reviews & growth plans** — Employee report cards, and AI-suggested growth paths: skills to build, courses to take, the next role.
- **Real conversations, real data** — Every meeting is captured and turned into tasks on the dashboard — talk becomes accountable work.
- **Where we want to go** — North Stars — the company's targets, every metric against plan, tracked daily.
- **Daily briefings, in your inbox** — A morning briefing and an end-of-day summary, sent automatically, every day.

## A look inside: The card the whole team sees first

> **CEO Briefing** — refreshed 6:04 AM · shared
>
> - Revenue closed at **₹7.9L** across **612 orders** — just under the ₹8L bar; Bangalore and Hyderabad carried the day.
> - Procurement held at **38%** of revenue — inside range. Rose ran hot at ₹142/kg; **have Geetha confirm the Hosur lot before 9 AM.**
> - Two cities haven't filed their manpower plan for the week — **Pune and Chennai**. Nudge sent.
> - Ops planning otherwise complete. Fill rate will settle by 4 PM as invoices land — no action yet.

The AI CEO briefing card — Smoke Grey on the team's home page, generated once at dawn and cached for everyone.

## 02 — Under the hood: How I built it

The whole thing is deliberately lightweight: static pages, a single Realtime Database, a stack of Cloud Functions, and the Claude API doing the thinking. No microservice sprawl — just a fast feedback loop where a change ships in fifteen seconds.

### Frontend

- Static HTML per page on **Firebase Hosting** — one page per surface
- Shared vanilla-JS modules in `/code`
- No framework; cache-busting script loaders for instant deploys

### Data

- **Firebase Realtime Database** as the single source of truth
- Orders, procurement, attendance, invoices, cash — one tree
- A nightly `AIMemory` layer distils it for the AI

### Logic

- **Cloud Functions (Node 20)** — HTTP endpoints + scheduled jobs
- Morning briefing, EOD summary, daily plans, anomaly scan
- All on Asia/Kolkata cron, written to be idempotent

### Intelligence

- **Anthropic Claude** — Sonnet for quality, Haiku for cheap batch work
- A shared persona builder with baked-in business rules
- Tool-use loop so the AI queries live data on demand

### Integrations

- **Zoho Books** REST API — push payments & bills with one click
- **Fireflies** — meeting transcripts synced every 30 minutes
- Gmail SMTP for the daily briefing emails

### The discipline

- Cache aggressively, recompute rarely — AI calls are slow and costly
- Everything timestamped with a reload button
- Role-based home pages: you see your cockpit, not everyone's

The architecture has one organising idea: **the database is the truth, the AI is the narrator.** Every night a job walks the entire operation and writes a compressed, human-readable memory — eleven categories covering clients, cities, flowers, cashflow, festivals, labour, wastage, farmers, pricing and the company's North Stars. The next morning the AI reads that memory instead of re-querying everything, which keeps the briefings fast, cheap, and consistent across the team.

## 03 — The design thinking: Mapping it onto good dashboard design

A dashboard fails the moment it becomes a wall of numbers nobody acts on. I designed this one against a handful of principles, and every screen earns its place against them.

### P01 Answer first, data second

People come to a dashboard with a question, not to admire a chart.

**Here:** the AI CEO briefing sits at the very top of every home page and answers "what should I care about today?" before a single table loads.

### P02 Targets, not just actuals

A number alone means nothing — it needs a line to beat.

**Here:** the North Stars page shows every metric against plan, colour-coded, drill-downable. Green / amber / red, never raw figures.

### P03 Progressive disclosure

Glance → scan → drill. Detail should be one click away, not in your face.

**Here:** KPI strip up top, collapsible sections below, full tables behind a click. The floor supervisor and the founder use the same page differently.

### P04 Severity has a colour

The eye should find the problem before the brain reads the label.

**Here:** a consistent system — amber warns, red blocks, green confirms, purple is the AI's voice. Used identically on every surface.

### P05 One source of truth

Two numbers that disagree destroy trust in all of them.

**Here:** one Realtime Database feeds every page, every email and all three AI executives. Revenue means the same thing everywhere.

### P06 Every insight ends in an action

Information that doesn't change a decision is decoration.

**Here:** the AI attaches a concrete next step to every gap, and the system can turn that into a task, a nudge, or a line in tomorrow's email.

### P07 Role-based by default

A finance lead and a warehouse supervisor want opposite things.

**Here:** sales, procurement, accounts, ops and HR each get a purpose-built front page; the AI even softens its tone for team-facing views.

### P08 Come to me, don't make me look

The best dashboard is the one you don't have to open.

**Here:** daily briefing emails, EOD summaries and proactive nudges push the signal out — the screen is for when you want to dig.

## The two executives: The AI CEO & the AI CFO

The centrepiece. Two distinct intelligences — one watching the whole operation, one obsessed with cash — sharing the same memory but reasoning with different priorities, the same way a real CEO and CFO would.

### The AI CEO — A chief executive that never sleeps

It opens with what's on track, attaches one concrete action to every gap, and ends with direction rather than alarm. It knows the business rules cold — revenue is final by 6 AM, fill rate lags till afternoon, partial invoices land the next day — so it never cries wolf.

- **Morning briefing** at dawn — the day's shape in four bullets
- **Personal daily plans** — each manager gets their own priorities, their reports' progress, and a nudge if they skipped yesterday's check-in
- **Proactive nudges** — a 30-minute scan turns threshold breaches into pings
- **EOD summary** — what broke, what got decided, what's at risk
- **A tool-use console** — ask anything; it runs live queries and cites the numbers
- **Persona modes** — full candour for founders, encouragement for the team

### The AI CFO — A finance brain that thinks in cash

Same data, different obsession. Where the CEO thinks in fill rates and coverage, the CFO thinks in working capital, payment cycles and the peak shortfall this week. It allocates pending cash and plans which bills to clear when.

- **12-month P&L projection** — five years of seasonality plus the festival calendar, updated daily
- **P&L by city** — finally answers "which cities actually make money?"
- **Cash allocation** — given today's bank balances and dues, what gets paid
- **Risk flags** — payment-cycle gaps and shortfalls, before they bite
- **SOPs & statutory dues** in one checklist, never missed

North Stars — every company metric against its target, the way the AI executives read the business.

## The third executive: The AI CMO & the marketing engine

Hoovu's brand lives on the Hindu calendar — every tithi, ritu and festival is a reason to post. So the dashboard has a third intelligence: an **AI CMO** that turns that calendar into a daily publishing rhythm. It doesn't just suggest captions — it reasons over a deep brand ontology, places a whole month of content, writes the post, generates the hero image, and lays out the final creative in Hoovu's own visual language.

### The AI CMO persona — A chief marketing officer with taste

A persona threaded through every call — distinct from the CEO. Its priorities are ranked the way a real CMO's are: **brand resonance first**, then audience truth, then calendar and commerce leverage, then reuse, then production feasibility. It's culturally fluent (it knows which flower belongs to which deity, which festival lands when, and how Ugadi in Karnataka differs from Gudi Padwa in Maharashtra) and it has platform instinct for what actually works on a reel versus a carousel.

### 1 · A brand ontology, not a prompt

Instead of stuffing the brand into one long prompt, everything Hoovu *is* lives as structured, editable nouns the engine composes from — the same reusable building blocks a human marketing team carries in its head.

- Content buckets — 25 — Mythology, Flower of the day, Festival, Behind the scenes
- Entity collections — 16 — Gods, Flowers, Festivals, Saints, Temples
- Entities — ~200 — Lord Ganesha, Mallige, Navaratri, Sevanthi
- Channels — 16 — IG main, IG flowers, YouTube, LinkedIn
- Languages — 10 — English, ಕನ್ನಡ, தமிழ், हिन्दी, తెలుగు
- Personas — 3 — Sunita, Rajalakshmi, Pushpa
- Style templates — aesthetic briefs — palette + type + mood
- Cities — 9 — regional festivals

### 2 · Ontology → calendar → finished creative

The engine runs in three stages, each one a place the marketer can step in and steer.

- **Plan the month** — An algorithm places slots across the month grid — date, platform, bucket, entity, hook — then the AI CMO refines: narrative threads, persona coverage, festival timing, mix balance.
- **Write the post** — Each slot becomes a draft — caption, reel script, hashtags, CTA, visual direction — in the right language and the right voice for that channel and persona.
- **Design the creative** — It generates a hero image, then lays it out as HTML+CSS slides in Hoovu's editorial style — brand chrome, typography and motion baked in, ready to screen-record as a reel.

The content calendar — a month placed algorithmically, then refined by the AI CMO. Festival days (amber) pull in the right deity and flowers automatically.

### 3 · From a slot to a finished post

Instagram · main · Bucket: Festival · Entity: Navaratri · Format: carousel · Voice: devotional

AI-written caption:

> Across nine nights, we celebrate nine forms of the Goddess — and tradition gives each her own bloom. Shailaputri loves the hibiscus; Kushmanda, the marigold. Swipe to find the flower for tonight's devi, and bring her form to your puja. 🌸

Hashtags: #Navaratri #Hoovu #PujaFlowers #NineNights #freshtakeontradition

The hero image is generated (text baked in for a *full-creative* post, or left clean and overlaid with HTML type for a *hero-only* one), then composed into Hoovu's editorial layouts — poster-centred, photo-card overlay, or scattered flower cut-outs.

### 4 · Design discipline, in code

**Structural guardrails — Off-brand is hard to do**

- A safe-zone CSS layer makes text-bleed structurally impossible — every headline scales to the slide and stays inside the margins
- A motion library of named animations gives reels life without bespoke code
- Layout skeletons encode Hoovu's real visual language — poster-centred, editorial card overlay, scattered flower cut-outs

**Brand brief as live data — The art direction is editable**

- The design brief lives in the database in my own words — narrative, what to prefer, what to avoid — and every image call reads it fresh
- Platform best-practices recompile themselves weekly, so the engine keeps up with what each channel rewards
- Generated images, references and past posts all live in one tagged asset library the AI draws from

## On the floor: The AI CEO plans the packing day

Every morning the warehouse has to turn thousands of orders into packed, sealed, barcoded packets — and out the door before each client's dispatch cutoff. On the orders page, the AI CEO reads today's orders, who showed up for work, the flowers that arrived, and the machines available, then writes the whole floor plan: who works on what, in what order, and when each client must move to sealing.

The packing plan — teams, sequence, station schedule and a live progress bar. Mark work done as it happens; the AI replans around what's left.

It knows the craft: **garlanding is the bottleneck**, so it starts every garland SKU at the top of the shift; loose flowers get weighed before sealing; whole items like lotus and betel leaf are just counted into a bag. As packets get sealed, the floor supervisor taps a block and logs progress — and the AI re-plans around what's actually left, shifting people to wherever the day is running behind.

## Run the meeting on the data: Every meeting has a dashboard page

Meetings at Hoovu don't happen over a slide deck someone built the night before — they happen *on the live dashboard*. Every recurring meeting is tied to a specific page, so the data and the agenda are the same thing, and everyone in the room is looking at the current truth.

- Ops Excellence review — Mon · fill rate, AOV, labour, wastage — `opsExcellencePage.html`
- Sales meeting — Wed · city × client coverage — `salesFrontPage.html`
- Cash & P&L review — Fri · runway, payment cycles — `cfoPlanning.html`
- North Stars check-in — Daily · targets vs actuals — `northStars.html`

Present mode dims the page, spotlights one metric at a time against its target, and lets anyone raise a task on the spot — which lands on the owner's dashboard instantly.

The dashboard steps through the page's own numbers one at a time — each with its target, a ✓ or ✗, and a one-tap button to **raise a task the moment something's off**. The agenda writes itself from the data, the discussion stays anchored to real figures, and the action items are already on the right person's dashboard before the meeting ends. Combined with the meeting-to-task pipeline below, nothing said in a room gets lost.

## Forecasting: Predicting the price of flowers

Flowers are a brutally volatile commodity — a rose can double in price the week of a festival and halve the week after. Procurement decisions worth lakhs get made at 4 AM in a wholesale market. So the dashboard forecasts tomorrow's price *before* the buyer leaves for the market.

The model is intentionally interpretable rather than a black box — a buyer has to trust it at dawn. It starts from a **seven-year price history** for each flower variety in each city, builds a **seasonal baseline** (jasmine in May behaves nothing like jasmine in December), layers a **festival multiplier** from the Hindu calendar (demand spikes around Varamahalakshmi, Navaratri, Diwali are learned, not guessed), and then nudges the whole thing with the **last few days of live market prices** the team logs. Each prediction ships with a **confidence band**, so a buyer knows when to trust it and when to haggle.

Illustrative forecast view — predicted price per variety, festival premium, trend and a confidence band.

## Closing the loop: Meeting notes that become tasks

The most quietly powerful feature. Decisions made in a meeting usually evaporate the moment everyone leaves the room. Here they don't — the conversation itself becomes accountable work on the dashboard.

Every meeting is recorded through **Fireflies**, which transcribes and extracts action items. A job syncs those transcripts into the database every thirty minutes, where each action item is matched to a person and written out as a **task with an assignee, a due date and a link back to the meeting it came from**. It surfaces on that person's front page, feeds into their personal daily plan, and the AI CEO can see it when reasoning about whether someone is keeping up. Talk in, accountability out.

1. **The meeting** — "…ok so Geetha will lock the Hosur rose contract by Friday, and we need Priya to chase the Zepto receivable — it's 40 days now. Let's also get the Pune manpower plan filed before the weekend…"
2. **Fireflies extracts** — action items with owner, text and due date.
3. **Tasks on the dashboard** — Lock Hosur rose contract · due Fri (Geetha · from Procurement sync); Chase Zepto receivable (40d) (Priya · from Procurement sync); File Pune manpower plan (Pune lead · this week).

## Close

> The database is the truth. The AI is the narrator. The team just has to act.

What I'm proudest of isn't any single feature — it's that the dashboard **compounds**. Seven years of history feed a nightly memory; that memory feeds three AI executives; those executives brief the team, predict prices, plan the marketing calendar, and convert meetings into tasks; the team acts, which writes new data, which deepens the memory. Every day it knows the business a little better than the day before.

And it does all of this while still feeling like Hoovu — warm, specific, a fresh take on a very old tradition.

Firebase Hosting + RTDB · Cloud Functions · Node 20 · Anthropic Claude (Sonnet + Haiku) · OpenAI gpt-image-1 · Zoho Books API · Fireflies · Vanilla JS · no framework
