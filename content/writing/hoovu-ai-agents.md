---
title: How to build an AI agent into your dashboard — a field guide
dek: A practical playbook from building Hoovu's AI CEO, CFO and CMO.
tags: ai-agents, dashboards, prompt-design, hoovu
source: https://rheakaru.github.io/projects/hoovu-ai-agents.html
---

How to build an *AI agent* that actually runs inside your dashboard.

Most "AI in the product" is a chat box bolted onto the corner. The agents that earn their keep are different: they have a personality, a ranked sense of what matters, a memory of the business, real tools to query live data, and the right surfaces to speak through. Here's the playbook I used to build three of them — an AI CEO, an AI CFO and an AI CMO — into one operational dashboard.

Written by **Rhea Karuturi** · CTO & co-founder, Hoovu Fresh

- ① **Personality** & tone
- ② Ranked **priorities**
- ③ Seeded **memory**
- ④ Real **tools**
- ⑤ The right **surfaces**

## The mental model

### An agent is a loop, not a feature

Before any prompt engineering, get the shape right. A useful agent sits on top of a loop that turns raw data into a point of view, and a point of view into action that creates more data. Build the loop first; the personality is the last 10%.

- **Data** — Your real operational truth — orders, cash, attendance.
- **Memory** — A nightly-distilled, agent-readable summary of that data.
- **The agent** — Persona + priorities + tools, reasoning over the memory.
- **Surfaces** — Briefings, chat, emails, nudges — where it speaks.
- **Action** — People act → new data → the loop deepens.

Every day it knows the business a little better than the day before — because the loop feeds itself.

## Act I · Give it a mind

### Personality, tone & priorities

This is what separates an assistant from a colleague. An agent that knows who it is, how to speak, and what to care about feels like a member of the team — not a search box.

### 01 · Personality — Give it a self, and make it one of "us"

The single highest-leverage line in the whole system is the identity statement. Our agents don't say "the data shows" — they say "we". They're cast as a specific executive with a specific temperament: the CEO is calm, assured and direct; the CFO is a cash-obsessed realist; the CMO has taste and cultural fluency. Naming the role and the temperament up front colours every sentence that follows.

A persona builder, shared across every call:

```js
// One builder. Every prompt in the system flows through it,
// so the voice is identical in a briefing, an email or a chat.
function buildSystemPrompt(mode, staffMap) {
  const base = `You are the AI CEO of Hoovu, a B2B puja-flower
    supply chain in 9 cities. Voice: calm, assured,
    data-driven, direct. Use "we" — you are part of
    this team. Open with what is on track. Attach a
    concrete action to every gap. End with direction,
    not alarm.`;
  return base + toneFor(mode) + rulesBlock() + staffBlock(staffMap);
}
```

**Takeaway:** write the identity once, in a shared builder. Never hand-write a personality inline in a feature — it drifts instantly.

### 02 · Tone — Define tone as switchable modes, not one voice

The same fact needs to be said differently to different people. To a founder, "cash is tight this week" is useful candour. To the warehouse team, it's needless anxiety. So tone is a *mode* the builder switches on — same brain, different register. We ban specific words in team mode and require honesty in founder mode.

**Founder mode**

> "Peak cash gap hits ₹4.2L on Thursday — hold the vendor run till Friday's Zepto receivable lands."

Full candour: runway, shortfall, severity. They can handle it; they need it.

**Team mode**

> "Labour's running a little above plan this week — let's tighten the afternoon shift to bring it back."

Never "crisis", "burn", "emergency". Every gap framed as a clear, reachable target.

**Takeaway:** bake the forbidden and required words into the mode, not the feature. Tone is policy, and policy belongs in one place.

### 03 · Priorities — Rank what it cares about, explicitly

An agent with no priorities gives you a flat list of everything. An agent with a ranked value system gives you a *point of view*. The CMO, for instance, is told its priorities in order — and when two pull against each other, it knows which wins. The CEO leads with what's on track; the CFO thinks in cash before anything else. Rank order is how you get judgment instead of a data dump.

The AI CMO's ranked priorities:

1. **Brand resonance** — does this feel unmistakably like us?
2. **Audience truth** — does it speak to a real person's devotion?
3. **Calendar & commerce leverage** — does the timing earn its place?
4. **Reuse** — can we get more from what we already have?
5. **Production feasibility** — can we actually ship it this week?

**Takeaway:** a numbered priority list in the prompt is the cheapest way to turn a model into something with taste and judgment.

### 04 · Domain rules — Bake in the rules so it never sounds naïve

The fastest way to lose trust is for the agent to flag something that isn't actually a problem. So we encode the business's lived rules directly into the persona: revenue is final by 6 AM, so never say "tracking well"; fill rate reads 0% before 2 PM because invoices aren't entered yet, so don't panic; partial invoices land the next day, so don't flag a 48-hour gap. These rules are applied silently and never narrated.

Rules block, injected into every prompt:

```
// Apply silently — never name these rules to the reader.
- Revenue is FINAL by 6 AM IST. Never say "at this pace".
- Fill rate = 0% before 2 PM is normal. Flag only after 4 PM.
- Partial invoices fill NEXT day. Don't flag a <48h gap.
- Procurement 36–45% is fine; flag only if > 45%.
- Benchmarks: fill ≥97% · labour ≤8% · AOV ≥₹35.
```

**Takeaway:** domain rules are guardrails against false alarms. Every embarrassing "the AI said something dumb" moment becomes one new line here.

## Act II · Give it memory

### Seeding data, summaries & nightly updates

You can't paste a whole database into a prompt — it's too big, too slow, too expensive. The trick is to distil your raw data into a compact, human-readable memory the agent reads instead. This is the part everyone skips, and it's the part that makes the agent *smart*.

### 05 · Seed the memory — Turn raw rows into narrated knowledge

Raw data answers "what happened". Memory answers "what does it mean". We walk the whole operation and write a memory layer organised into eleven categories — clients, cities, flowers, cashflow, festivals, labour, wastage, farmers, pricing, tasks and the company's North Stars. Crucially, each category gets both **structured metrics** and a **short narrative** in plain language — because the narrative is what the agent reasons on most fluently.

Memory shape — metrics + a narrative, per entity:

```
AIMemory/
  clients/narrative: "Zepto is our largest account but
     receivables have crept to 40 days. Swiggy steady…"
  clients/zepto: { daysSinceLastOrder: 0,
     revenueTrendPct: -8, fillRate: 0.97 }
  flowers/narrative: "Rose running hot pre-Navaratri…"
  cashflow/summary: { peakGapDay: "Thu", gap: 420000 }
  cities, festivals, labour, wastage, farmers,
  pricing, tasks, northstars  // 11 categories total
```

**Takeaway:** write summaries *for the agent* the way you'd brief a sharp new hire — numbers where they help, a sentence of context around them.

### 06 · Summarise, don't re-query — Compress aggressively; the context window is precious

Once the memory exists, every surface reads *it* — not the database. The morning briefing doesn't re-aggregate a month of orders; it reads the pre-written P&L narrative and the day's numbers. This keeps responses fast, cheap and — most importantly — **consistent**: every surface tells the same story because they all read the same memory.

- One expensive computation at night → many cheap reads all day
- The same memory feeds the briefing card, the emails, and the chat console
- Compression is a feature: a tight narrative beats a giant JSON blob in a prompt

**Takeaway:** the memory is your cache and your single source of truth at once. Compute it once, read it everywhere.

### 07 · Nightly updates — Re-seed on a schedule, while everyone sleeps

The memory is rebuilt every night at 11:30 so the morning briefing reads a fresh picture. Scheduled jobs do the heavy lifting off-peak: the nightly memory build, the morning briefing, the end-of-day summary, personal daily plans, and a weekly recompile of platform best-practices for the CMO. Each job is idempotent and logs its own failures, so a bad night never corrupts the memory.

Scheduled jobs (Asia/Kolkata):

```
23:30  → rebuild AIMemory (all 11 categories)
06:00  → morning briefing  (reads last night's memory)
10:30  → personal daily plans  (per manager)
18:30  → end-of-day summary
Mon 04:00 → recompile platform skills for the CMO
// every 30 min → anomaly scan → proactive nudges
```

**Takeaway:** the agent feels alive because something is always running. Schedule the thinking; surface the results when people show up.

## Act III · Give it hands & a voice

### Tools, caching & the right surfaces

A mind with memory is still trapped until you give it tools to fetch what it doesn't know, and surfaces to speak through. This is where the agent stops being a report and starts being a presence.

### 08 · Tools — Give it tools, with strict contracts

The nightly memory can't hold everything, so the chat console gets **tools**: a set of functions it can call to query live data mid-conversation. The model plans, calls a tool, reads the result, and either answers or calls another — a tool-use loop. The discipline is in the *contract*: every tool caps its date range, caps its result size, and returns a predictable `{ summary, data, notes }` shape so the model never drowns in rows.

A tool contract the model can rely on:

```js
getCityPnL({ city, fromDate, toDate }) {
  // 1. cap the range — never let it ask for 2 years
  range = clampDays(fromDate, toDate, 90);
  // 2. compute, then cap the payload (~30KB)
  return {
    summary: "Bangalore: ₹2.1L revenue, 41% procurement…",
    data:    rows.slice(0, 200),
    notes:   "Fill rate excludes today (invoices pending)."
  };
}
```

**Takeaway:** tools are where agents go wrong. Constrain inputs, cap outputs, and always return a one-line summary the model can quote without reading the raw data.

### 09 · Cost & speed — Cache like the calls are expensive, they are

AI calls are slow and cost real money, so nothing recomputes that doesn't have to. The briefing card uses a three-tier cache: it checks the browser first, then a shared server-side cache (so the first teammate to log in pays for everyone), then the API only if both miss. Everything is timestamped — "generated 2h ago" — with a manual refresh button for when you truly want a fresh take.

- **Tier 1 — localStorage:** instant, this user, this device
- **Tier 2 — shared server cache:** one generation per day, reused by the whole team
- **Tier 3 — the API:** only when both miss, or on explicit refresh

**Takeaway:** default to "show the saved one"; make fresh generation a deliberate act. Your bill and your latency both thank you.

### 10 · Surfaces — Choose the surface to match the moment

The same agent shows up in four different ways, each suited to a different need. Get this mapping right and the agent meets people where they already are — instead of asking them to come find it.

**The briefing card** — When: you open a page. A few bullets at the top of every home page — the answer before the data. Passive, glanceable, always there.

> CEO Briefing
> - Revenue closed at ₹7.9L — just under the ₹8L bar.
> - Rose running hot; confirm the Hosur lot before 9 AM.

**The chat console** — When: you have a question. A tool-using console for the long tail. Ask anything; it runs live queries and cites the numbers. Active, conversational.

> Which city has the worst fill rate this week?
>
> `getCityPnL · 7d` — Chennai, at 94.1% — two missed Swiggy slots on Tuesday. Want me to raise it with the city lead?

**Daily emails** — When: you're not even in the app. Morning briefing, EOD summary, personal daily plans — pushed to the inbox so the dashboard comes to you.

> aiceo@hoovu.in · 6:02 AM — Your Daily Plan · 3 priorities
>
> Good morning. Today: lock the Hosur rose lot, chase the Zepto receivable (40d), and your team owes the Pune manpower plan.

**Proactive nudges** — When: something breaks a threshold. A 30-minute scan turns anomalies into pings — and pings into tasks. The agent reaches out first.

> Labour cost crossed 9% — Bangalore afternoon shift is overstaffed for today's order book. Raised as a task for the city lead.

Passive when you're busy, active when you're curious, push when you're away, proactive when it matters. The art is matching the surface to the moment — not forcing everything through a chat box.

## Putting it together

### The build checklist

If you're building your own, this is the order I'd do it in — mind first, memory second, hands and voice last.

- **Identity** — one shared persona builder, cast as a specific role with a temperament.
- **Tone modes** — switchable registers with banned/required words per audience.
- **Ranked priorities** — a numbered value system so it has judgment, not just facts.
- **Domain rules** — the lived business logic, applied silently, to kill false alarms.
- **Seeded memory** — raw data distilled into metrics + narratives, by category.
- **Summaries over queries** — read the memory everywhere; compute once.
- **Nightly schedule** — idempotent jobs that rebuild memory and push results.
- **Tools with contracts** — capped inputs, capped outputs, predictable shape.
- **Aggressive caching** — three tiers, timestamped, manual refresh.
- **The right surfaces** — briefing, chat, email, nudge — matched to the moment.

> Don't build a chatbot. Build a colleague — one with a point of view, a memory, and the manners to speak up only when it helps.

None of this requires a heavy stack. Ours runs on static pages, one database, a handful of scheduled functions, and a couple of model APIs. The hard part was never the infrastructure — it was the judgment: deciding who the agent is, what it values, what it's allowed to say, and where it's allowed to interrupt. Get those right and the technology is almost incidental.

Persona builder · Seeded memory · Tool-use loop · Scheduled jobs · 3-tier cache · Briefing · chat · email · nudge
