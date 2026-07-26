---
title: ComPrice — Building commodity price intelligence for Indian mandis
dek: Don't compromise with your data. ComPrice it.
tags: comprice, agri-data, nextjs, claude, firebase
source: https://rheakaru.github.io/projects/comprice.html
---

Commodity price intelligence for India's APMC mandis — built over the Government of India's Agmarknet feed, with satellite market cards, 90-day price history, and Claude-generated market briefs.

## What ComPrice does

Turning a sparse government data feed into something a trader can actually use.

Prices in India's agricultural markets — the regulated *APMC mandis* — are published daily by the government through **Agmarknet**. The data is public, but it's raw: dates in `DD/MM/YYYY`, markets that report on irregular days, no arrival volumes, and no way to see a trend at a glance. For a procurement manager or a trader trying to decide where to buy, it's a spreadsheet, not an answer.

ComPrice sits on top of that feed and makes it legible. Pick a commodity and a state, and you get a grid of **market cards** — each one a mandi, with its latest modal price (₹/quintal), how much it moved since the last report, a freshness badge so you know how stale the number is, and a satellite view of the market location. Tap into any market and you get a **90-day price history chart**, a breakdown of varieties, and a short **AI brief** written by Claude that reads the price series and tells you what's actually happening in plain language — without ever giving buy/sell advice.

- **Market grid — Satellite price cards.** Every mandi reporting a commodity, with modal price, % change, freshness, and a satellite tile of the location.
- **Detail view — 90-day history + varieties.** A price chart per market, varieties broken out, and stat blocks for price, change, and recency.
- **Intelligence — Claude market briefs.** A 3–4 sentence brief grounded only in the data — current level vs. 30/90-day average, unusual moves, one actionable note.
- **Trust — Sourced & compliant.** Every price credits its source. Not SEBI-registered, so briefs stay descriptive — no trading recommendations.

## A look at the app

Recreated below from the real ComPrice UI — the home grid and a market detail view.

Home grid — one card per mandi, with a satellite tile and the freshness of each price.

Market detail — stat blocks, a 90-day chart, a Claude brief, and placeholders for the v2 roadmap.

## How I built it

The stack, and the few decisions that actually mattered.

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Firebase Auth
- Firestore
- Firebase App Hosting
- Anthropic SDK · claude-sonnet-4-6
- Recharts
- Google Static Maps

### The data layer is the whole game

Agmarknet exposes prices through a `data.gov.in` resource. The client in `lib/agmarknet.ts` handles every quirk so the rest of the app doesn't have to: it normalizes `DD/MM/YYYY` dates to ISO at ingest, always shows the *most recent record per market* (never "today's", because mandis report sparsely), averages multiple varieties for the grid but breaks them out on the detail page, and computes `% change` against the previous record for that market — not yesterday. Volume isn't in the feed at all, so the UI honestly says "Volume: N/A" with a tooltip rather than faking it.

### Scraping is a privilege, not a right

The project ships with an explicit **scraping policy**. The hard rule: **no scraping ever happens in a user request path.** All ingestion runs in cron-triggered endpoints gated by a secret token; the user-facing API only ever reads from Firestore. That means a flaky government portal can never block the UI. Add a real `User-Agent`, a 2-second delay between requests, exponential backoff, kill-switch env flags per source, and an audit trail of every ingest run — and you have something you can run without being a bad citizen of the open-data ecosystem.

### Cache aggressively, fall back to stale

Every expensive thing is cached in Firestore with a sensible TTL — grids for 6 hours, detail pages for 1 hour, AI briefs for 1 hour (so I'm not burning Claude tokens on every page view), and geocoded coordinates *forever* because mandis don't move. The important part is the **stale fallback**: if Agmarknet is unreachable, the grid serves the last good data with a visible "showing cached data" banner instead of erroring out.

### The AI brief stays in its lane

The brief is a single Claude call per market, fed only the price history. The system prompt is strict: be specific with numbers, don't speculate beyond the data, say so when the data is too sparse — and **never give buy/sell recommendations**, because ComPrice isn't SEBI-registered. Low temperature, a 400-token cap, and a visible disclaimer on every brief keep it descriptive and trustworthy.

> **The honest part:** v1 deliberately leaves placeholders for the hard stuff — satellite-derived activity indices, inter-mandi arbitrage, and price prediction. They're rendered as "coming soon" cards rather than half-built features, so the architecture has room for them without pretending they exist yet.

## Build it yourself

Paste this into Claude Code (or any capable coding agent) to scaffold your own version.

```
Build "ComPrice", a commodity price intelligence web app for Indian APMC mandis.

STACK
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Firebase: Google Auth, Firestore (cache + user prefs), App Hosting
- Anthropic SDK (claude-sonnet-4-6) for market briefs
- Recharts for price history; Google Static Maps for satellite tiles
- Fonts: Inter (UI) + JetBrains Mono (all prices/numbers). Neutral palette,
  white cards on a neutral-50 background. Tagline: "Don't compromise with
  your data. ComPrice it."

DATA SOURCE
- Pull commodity prices from the data.gov.in Agmarknet resource (modal/min/max
  price per market per day). Normalize DD/MM/YYYY dates to ISO at ingest.
- Markets report sparsely: always show the MOST RECENT record per market, not
  "today's". Compute % change vs. that market's PREVIOUS record. Average
  multiple varieties for the grid; break them out on the detail page.
- Volume is not in the feed — show "Volume: N/A" with a tooltip, never fake it.

ARCHITECTURE (non-negotiable)
- NEVER scrape/fetch external data in a user request path. The user-facing API
  reads ONLY from Firestore. All ingestion runs in cron-triggered endpoints
  gated by a secret token (X-Ingest-Token), with a real User-Agent, a 2s delay
  between requests, exponential backoff, per-source kill-switch env flags, and
  an audit-trail doc per run.
- Cache in Firestore with TTLs: grid 6h, detail 1h, AI brief 1h, geocoded
  lat/lng forever. On source failure, serve STALE cached data with a visible
  banner instead of erroring.

SCREENS
1. Login — Google sign-in only; everything behind it is auth-gated.
2. Home — state selector + commodity picker in a top bar; a responsive grid of
   market cards. Each card: satellite tile (Static Maps), market name + district,
   a freshness pill (fresh/ok/stale by age), modal price in mono, and % change
   (green up / red down). Persist the user's last state + commodity to Firestore.
3. Detail (/market/[id]/commodity/[id]) — breadcrumb, wide satellite image,
   four stat blocks (modal price, change, last updated, varieties), a 90-day
   price chart, a Claude-generated AI brief, and "coming soon" cards for
   satellite activity index, inter-mandi arbitrage, and price prediction.

AI BRIEF
- One Claude call per market, fed only the price history. System prompt: be
  specific with numbers, don't speculate beyond the data, say so if data is too
  sparse, and NEVER give buy/sell advice (not SEBI-registered). Temp 0.3,
  max 400 tokens. Show a disclaimer under every brief.

COMPLIANCE
- Credit the data source on every price surface. Briefs are descriptive only.

Start with the data client and types, then the cached API routes, then the UI.
Keep secrets in .env.local and gitignore it (plus the Firebase deploy cache).
```
