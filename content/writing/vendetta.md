---
title: Vendetta — a quieter way to see your friends
dek: a quieter way to actually see the people you keep meaning to see.
tags: social, ios, react, firebase, claude, product-design
source: https://rheakaru.github.io/projects/vendetta.html
---

a quieter way to actually see the people you keep meaning to see.

an ios & web app · react · firebase · claude

## What it is

### not a calendar. not another group chat.

i have plenty of friends, a calendar, and a dozen group chats — and i still don't see people. the bottleneck was never intent. it's that nobody wants to be the planner. vendetta is a small, quiet layer that does the coordinating work, so the plan just happens.

### 01 — a living home

no feed, no list. the home is a bubble universe — friends who are free tonight, their interests, things to do in your city. the whole canvas re-tints across nine palettes as the day moves from midnight to night.

### 02 — a planner that does the type-a work

open a chat and an in-thread ai runs the whole plan: reads both rosters, finds the overlap, polls activities, narrows times against your calendars, suggests real named venues, confirms.

### 03 — a private social diary

every confirmed plan becomes a diary entry — drafting, confirmed, live, past, logged. after a hangout, a soft nudge to write a note. over a year it becomes a record of who you actually showed up for.

### 04 — travel mode

type any city and the bubbles fall away, then re-form around that destination — friends who live there, plus activities curated for it.

## Views

### how it feels in the hand.

these mockups use the exact same palette variables as the app, so they tint with the switcher above too — try changing the time of day and watch them move with you.

- home — the bubble universe
- chat — the planning engine
- diary — what actually happened

## How I built it

### three layers, one quiet machine.

- **Client** — react 18 + vite, tailwind, capacitor for ios
- **Backend** — cloud functions, node 22, express, one https fn
- **Data** — firestore, realtime onSnapshot
- **AI** — claude sonnet 4.5, @anthropic-ai/sdk
- **Auth** — firebase auth, native sign in with apple
- **Integrations** — calendar · places · ticketmaster · tmdb

### 1 · the bubble canvas

a stack of hooks — `useFriendBubbles`, `useMyInterests`, `useActivitySuggestions` — fans out three firestore subscriptions and an http call, merges them into one bubble list, and filters by home vs travel city. switching cities runs a falling → loading → idle state machine so old bubbles don't pop out before the new ones arrive.

### 2 · the chat planner (a server-driven state machine)

every chat carries a `planningState` that advances through nine states. the ai writes messages server-side as 'vendetta-ai' so they bypass client rules; votes live in a subcollection per poll. most "ai" moments aren't llm calls at all — overlap is a set intersection, times are calendar arithmetic. claude is reserved for the one thing only it can do: turning two people's tastes into a suggestion that sounds human.

`init → roster-poll → time-find → time-poll → venue-suggest → venue-narrow → summary → confirmed`

### 3 · the three-tier suggestion engine

the home feed never comes from one source. a city pool (claude-generated, cached forever), a personalized user pool (only in your home city), and live real-world data (ticketmaster + tmdb + places) get three-way interleaved — a[0], b[0], c[0], a[1]… so every scroll mixes something that knows you, something the city is known for, and something happening tonight. a nightly job refines each city from what people actually picked; a weekly job regenerates from scratch to catch real-world drift.

## The thinking

### why every choice is quiet on purpose.

**bubbles, not a list** — a list ranks. a list creates obligation — the top friend is the one you "should" see. bubbles are spatial, light, refusable. the home is a mood, not a to-do.

**the app knows what time it is** — most apps look identical at 7am and 11pm. vendetta moves with you — warm at dusk, inky at midnight. the difference between a tool and a companion.

**structured ai, not a chatbot** — when the ai commits to a venue, a time, a confirmed plan, it has to be deterministic, auditable, reversible. state on the chat doc — not buried in a transcript.

**a diary, not a feed** — posts are performative. a diary is private — which is exactly why people fill it in. it's the part nobody else sees, and the part that lasts.

**three sources, always mixed** — pure personalization is a filter bubble. pure curation is generic. pure real-data is a yelp list. interleaving forces every scroll to carry all three.

**what i left out** — no public profiles. no follower counts. no visible streaks. no dopamine notifications. the whole genre of social-app dark patterns is absent on purpose.

## The journal

### thinking out loud, while building.

cahoots — short recordings i made along the way, talking through the build as it happened.

- cahoots · one
- cahoots · two

## In real time

### posted while it was still half-built.

the build, narrated on x as it happened.

## Build it yourself

### the brief i'd hand an agent.

a self-contained prompt for claude code (or any agentic ide) to recreate vendetta from scratch.

```
Build Vendetta, a React + Vite + Firebase web app (Capacitor-wrapped for iOS) that helps small groups of close friends actually spend time together. Replace social-media patterns with quieter ones. The product is opinionated — match the tone exactly.

STACK: React 18 + Vite + Tailwind on the client. Firebase Auth, Firestore, and Cloud Functions (Node 22, Express behind a single exports.api = onRequest(app)). Anthropic SDK for AI calls. Optional: Google Calendar, Google Places, Ticketmaster, TMDB.

CORE SURFACES:
1. Home — the bubble universe. A canvas of floating circular "bubbles". Each is one of: a friend who marked themselves free tonight, a friend's pinned interest, the user's own interest, or an AI-curated activity for the user's city. The page background uses nine CSS-variable palettes (midnight, predawn, dawn, morning, midday, afternoon, golden, dusk, night) auto-selected by the current hour via a TimeThemeProvider. Typing a different city in the top bar triggers a falling → loading → idle transition.

2. Chats with a structured AI planner. Each chat document has a planningState field that advances through: idle → init → roster-poll → time-find → time-poll → venue-suggest → venue-narrow → summary → confirmed. AI messages are written server-side with senderId 'vendetta-ai'. Endpoints /api/chat/{init,vote,find-times,venue-suggest,respond,confirm,cancel} drive the state machine. Init compares both users' interest rosters and seeds a poll; time-find pulls Google Calendar busy windows and proposes 3 slots; venue-suggest calls Claude with both rosters + city pool + chosen activity and returns 3 specific named venues with a feedback loop.

3. Three-tier suggestion engine. GET /api/suggestions returns a merged stream of (a) a city pool — Claude-generated, cached forever, 25 ideas per city; (b) a personalized user pool, only when requested city == home city; (c) live Ticketmaster + TMDB + Places data. Three-way interleave: a[0], b[0], c[0], a[1], b[1], c[1]...

4. Social diary. Lists every plan involving the user. Phase computed client-side: drafting → confirmed → live → past → logged. After a plan ends, prompt for a private note.

5. Scheduled jobs. A nightly job reads recent picks + taps, groups by city, asks Claude to refine each list (keep resonant, replace ignored, add fresh). A weekly job regenerates each cached city from scratch. A Firestore trigger updates lastTogetherAt on the friendship when a plan is confirmed.

AI PROMPTING RULES (non-negotiable): all generated copy is lowercase, no emojis, no exclamation marks, no clichés. Tone: refined, understated, for well-traveled adults. Use real, named venues. 3–8 word activity labels. "Details" are 2–3 short sentences (max 180 chars) about the mood, not the logistics.

VISUAL LANGUAGE: italic serif headers, clean sans body, all UI strings lowercase. Empty states are evocative ("the city is still unfolding"). Every color is a CSS custom property so the hourly palette swap is one variable update.

WHAT NOT TO BUILD: no public profiles, no like/comment surfaces, no streaks shown to friends, no notification dopamine, no infinite scroll. The diary is private by default.

Build incrementally: auth + bubble canvas + rosters first; then the chat state machine; then the suggestion pipeline; then the diary; the scheduled jobs last.
```

built by rhea karuturi · 2026

the city is still unfolding.
