---
title: Cahoots — for you and your person
dek: A goal tracker built for two.
tags: cahoots, ai, firebase, react, claude, build-log
source: https://rheakaru.github.io/projects/cahoots.html
---

## What it is

### A goal tracker built for two.

Most goal software is built for one person staring at their own todo list, or for a whole company sharing a roadmap. There's almost nothing built for **two** — and the most important plots in life tend to be two-person plots.

A **cahoot** is a shared plot between you and your person (or a small group). You set a **northstar**, break it into **waypoints**, and file **dispatches** as you make moves. An AI co-pilot — built on Claude — knows the context of both of you and helps you plot the path and keep it honest as reality changes.

- **Northstar** — the goal you're working toward. Shared (one you both hold) or parallel (you each have your own, holding each other accountable).
- **Waypoints** — milestones along the way, each with its own AI-assisted strategy page.
- **The plot** — an interactive node-graph the AI generates per waypoint. Each node is a concrete step you can mark pending / active / done.
- **Dispatch feed** — an append-only journal of updates and reflections, with reactions and comments. The pace of a slow journal, not a chat app.
- **Invite link & public embed** — bring your person in with a code, or share a read-only view of a plot publicly.
- **Partner nudges** — file a dispatch and your person gets a (rate-limited) email so the back-and-forth keeps moving.

## A look inside

### The views.

Dark, quiet, intimate — Playfair Display over DM Mono, a single accent purple, lowercase microcopy. Built to feel private, not productive-app-loud.

- the sign-in screen — one tap in.
- the library — every plot you're in.
- the plot page — an AI-generated node graph per waypoint. green = done, glowing purple = active.
- the dispatch feed — an append-only journal between two people.

## How I built it

### Small stack, opinionated shape.

Six runtime dependencies, two dev. The whole frontend builds to a single Vite bundle. The bar I held the entire time: the data model should fit on one screen.

- **Frontend** — React 18 + Vite, React Router, and @xyflow/react for the interactive node graph.
- **Auth** — Firebase Auth, Google sign-in only — onboarding is exactly one tap.
- **Database** — Cloud Firestore. Security rules enforce per-cahoot membership; an opt-in flag opens read-only embeds.
- **Functions** — Firebase Cloud Functions on Node 20 — the AI proxy and the partner-email notifier.
- **AI** — Anthropic Claude — Opus 4.5 for roadmap reasoning, Haiku 4.5 for lightweight calls.
- **Hosting** — Firebase Hosting. One `firebase deploy` ships the whole thing.

### The data model

There are really only a handful of shapes in Firestore — cahoots, the waypoints (milestones) under them, the dispatches (logs), per-waypoint AI chat threads, and a private profile per user.

```
/users/{uid}                                  — public profile
/users/{uid}/profile/me                       — private about-me + AI intelligence
/invites/{code}                               — invite codes (publicly readable)
/cahoots/{id}                                  — members, northstars, publicEmbed
/cahoots/{id}/milestones/{id}                  — waypoints + the React Flow graph
/cahoots/{id}/milestones/{id}/chat/{id}        — per-waypoint AI chat threads
/cahoots/{id}/logs/{id}                        — dispatches (the journal feed)
```

### Security model

The Firebase web `apiKey` is *not* a secret — web keys are public identifiers embedded in every deployed app. The real security is membership-gated Firestore rules. The Anthropic key *is* secret: it lives in Firebase Secret Manager, is read only inside the Cloud Function, and never touches the browser. The client calls the function with its auth token; the function authorises, loads context, and proxies to Claude.

### The AI as named verbs, not a chatbox

The single biggest call I made: instead of one big "chat with AI" surface, the co-pilot exposes ~14 **structured actions**, all behind a single `cahootsAI` Cloud Function. Each one verifies membership, loads the relevant context (northstars, recent dispatches, the current graph, the caller's private profile), prompts Claude, parses the result, and writes it back to Firestore.

- `generateRoadmap` — first roadmap for a waypoint
- `reviseRoadmap` — edit a node from feedback or a "blocked" signal
- `evolveRoadmap` — re-plan the whole graph from what you've learned
- `projectNextMoves` — suggest the next 1–3 nodes off a node
- `commitNode` — you write a node; AI slots it in cleanly
- `attachAttempt` — link a dispatch to the node it was for
- `runAgentTask` — "do the next step" — returns a draft
- `promoteToNodes` — turn freeform text into graph nodes
- `brainstormFromNode` — explore options before committing
- `acceptBrainstormSuggestion` — promote an option into the graph
- `chat` — per-node thread shared with both members
- `synthesizeProfile` — distill a member into a private brief

### The partner notifier

One other function — `notifyPartnerOnDispatch` — fires when a dispatch is written, rate-limits to once per author per 12 hours (no spamming over one-line updates), and emails the other member a deep link back into the cahoot. That single feature — your person actually gets pinged when you show up — did more for retention than any in-app polish.

## Building in public

### My thinking, as it happened.

I recorded my thinking while building Cahoots and posted along the way. The walkthroughs and the build-log threads below are the unedited version of how this came together.

## Build it yourself

### The prompt.

Want your own version? Drop this into Claude Code in an empty directory and iterate. It captures the architecture closely enough that you'd land somewhere structurally identical to what I built.

```
Build a web app called "Cahoots" — a two-person (max 5) collaboration tool
for working toward a shared or parallel goal, with an AI co-pilot.

Stack:
- React 18 + Vite + React Router
- Firebase: Auth (Google only), Firestore, Cloud Functions (Node 20), Hosting
- @xyflow/react for an interactive node graph
- Anthropic Claude via @anthropic-ai/sdk for AI actions (key in Firebase Secret
  Manager, NEVER in client code)
- Aesthetic: dark, quiet, intimate. Background #0E0B13, accent purple #A87CE0,
  Playfair Display serif for headings, DM Mono for body, lowercase microcopy,
  generous whitespace.

Data model (Firestore):
- /users/{uid} — public profile (displayName, email, photoURL)
- /users/{uid}/profile/me — private: aboutMe, affiliations, networks,
  AI-synthesized intelligence brief
- /invites/{code} — invite codes, publicly readable so previews work
- /cahoots/{id} — { name, type (shared|parallel), members[], memberDetails{},
  northstars{}, publicEmbed, createdBy }
- /cahoots/{id}/milestones/{id} — waypoints, each holds React Flow nodes+edges
- /cahoots/{id}/milestones/{id}/chat/{id} — per-waypoint AI chat threads
- /cahoots/{id}/logs/{id} — dispatches (journal entries w/ reactions, comments)

Routes:
- /auth — Google sign-in, tagline "for you and your person."
- / — cahoot library (cards)
- /create — 3-step wizard: pick type, set size + northstar(s), get invite link
- /join/:code — invite landing, preview + join
- /cahoot/:id — detail: northstar header, milestones, dispatch feed, calendar
- /cahoot/:id/waypoint/:wid/plot — the plot page: React Flow graph + AI drawer
- /me — about-me page
- /embed/:id — read-only embed, only when publicEmbed === true

Security rules: ALL reads/writes under /cahoots/{id}/** must check that
request.auth.uid is in members[], EXCEPT when publicEmbed === true (read-only)
or for invite-code previews. Creator can delete; any member can update.

The AI co-pilot:
One callable Cloud Function `cahootsAI` (region us-central1) that takes
{ action, ...args } and dispatches to handlers. Load ANTHROPIC_API_KEY via
defineSecret(), never in code. Each handler: (1) verify auth + membership,
(2) load context (cahoot, waypoint, recent dispatches, caller's private
profile), (3) build a prompt with a <user>...</user> context block,
(4) call Claude (claude-opus-4-5 for heavy reasoning, claude-haiku-4-5 for
light), (5) parse JSON and write to Firestore.

Actions: generateRoadmap, reviseRoadmap, evolveRoadmap, projectNextMoves,
commitNode, attachAttempt, runAgentTask, promoteToNodes, brainstormFromNode,
acceptBrainstormSuggestion, setNodeStatus, setNodeFlag, chat, synthesizeProfile

Also a Firestore-triggered function `notifyPartnerOnDispatch`:
- fires on create at /cahoots/{cahootId}/logs/{logId}
- rate-limit: 1 notification per author per cahoot per 12 hours
- look up partner emails from /users/{uid}, send via Gmail/Nodemailer
- uses EMAIL_USER and EMAIL_PASS secrets

Constraints:
- single Vite bundle; all AI parsing server-side; key never reaches the client
- dispatch feed is append-only — only reactions and comments, no edits
- graph state lives in Firestore as { nodes:[], edges:[] } on the milestone,
  synced via onSnapshot
- lowercase microcopy throughout

Start by scaffolding Vite + Firebase and the auth flow. Get a working 1-cahoot
end-to-end loop (create → invite → join → file dispatch → email) BEFORE adding
the AI. Then add the plot page and AI actions one at a time, starting with
generateRoadmap.
```
