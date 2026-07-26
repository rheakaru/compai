---
title: The Brief — an anti-overwhelm news app
dek: An anti-overwhelm news app that opens as a near-blank page — you go as shallow or as deep as you want, at your own pace.
tags: news, ai, react, firebase, claude, product-design
source: https://rheakaru.github.io/projects/thebrief.html
---

An anti-overwhelm news app. It opens as a near-blank page — no images competing for attention, no headlines screaming. You go as shallow or as deep as you want, at your own pace.

React + Firebase + Claude · Built with Claude Code · 2026

## 01 — What it does

### A calm front page for the news

Most news apps are designed to keep you there: autoplay video, push alerts, infinite scroll, ten headlines fighting for the same square inch. The Brief is the opposite. It treats reading the news like reading a single, well-set page — quiet, finite, and yours to pace.

You land on a numbered list of about eight story leads, each a single sentence. Nothing expands until you ask it to. Tap a lead and it unfolds a short, Claude-written summary — no ads, no related-content rabbit holes, just the story.

The reading view — a masthead, category tabs, and a numbered list of one-sentence leads. Tap to expand.

### What makes it different

- **Concept chips.** Inside every summary, names and terms you might not know are tappable pills. Tap one for a one-line explanation, then *tell me more* for depth. Learn the background without leaving the story or feeling talked down to.
- **Ask anything.** Have a question about a story? Ask it in plain language. Claude answers using that story as context.
- **Follow a thread.** Mark a story to follow and The Brief keeps pulling the thread over time.
- **Your tabs, your place.** World, India, and your own city — plus up to three custom interest topics you add yourself.
- **It remembers what you learned.** Every concept you open is saved to a running list of what you picked up today.

### And a private inbox, reimagined

The Brief has a second life at `/inbox`: a personal Gmail dashboard that sorts every email into tactile, stacked-paper "bucket" cards — the stack gets visibly thicker the more mail it holds. Buckets match how you actually think about your inbox (work, banking, calendar, real conversations) rather than generic folders. There's even an "Emails you should send" feature that drafts outreach for you based on what you've been reading.

The inbox — emails sorted into stacked-paper buckets, depth proportional to volume.

## 02 — How I built it

### The build, end to end

I built The Brief with Claude Code — describing what I wanted in plain language and iterating on the result. The whole thing runs on Firebase, with Claude doing the editorial heavy lifting on the server.

- Frontend: React + Vite
- Hosting: Firebase Hosting
- Backend: Express on Cloud Functions
- Database: Firestore
- AI: Claude (Sonnet)
- News: GNews API
- Auth: 6-digit email OTP + JWT
- Styling: Vanilla CSS

### The shape of it

The frontend is a single-page React app installable as a PWA. The backend is one Express server deployed as a single Firebase Cloud Function that handles every `/api/*` route. All data lives in Firestore — and the security rules deny all direct client access. Every read and write goes through the server, where a JWT middleware is the real access-control layer. Nothing sensitive ever touches the browser.

### Where Claude does the work

Claude runs server-side only, never from the browser. It powers the editorial layer that turns raw articles into a calm reading experience:

- `summarise` — Turns a raw article into a short, plain summary with concept chips embedded.
- `rewrite lead` — Rewrites jargon-y headlines into one clear sentence.
- `select` — Picks the top stories from a larger pool of articles.
- `explain concept` — Generates the one-liner and the "tell me more" for each chip.
- `answer` — Responds to a reader's free-text question using the story as context.
- `suggest emails` — Drafts outreach for the inbox feature from your reading history.

To keep it fast and cheap, Claude-processed stories are cached in Firestore with a short time-to-live, and concept explanations are cached permanently — the second reader to open a story gets it instantly.

### The inbox, technically

The inbox connects to Gmail over OAuth 2.0 and streams your mail live on each load — nothing is stored. The clever bit is that classification into buckets is pure JavaScript running in the browser: a priority-ordered chain of domain and sender rules, no AI involved. The only AI in the inbox is the "Emails you should send" feature, which sends your context to Claude and gets back structured JSON with insights and ready-to-edit drafts.

### My process, in public

I built The Brief in the open, posting the wins, dead ends, and course-corrections along the way. Here's the build thread: follow the full build at @MillionPageProj.

## 03 — The design thinking

### Designing for calm, not engagement

Every decision in The Brief comes from one question: *what would a news app look like if it respected your attention instead of mining it?*

### Open with almost nothing

The app opens nearly blank on purpose. No hero image, no autoplaying anything, no notification badge demanding you. Just a title, the date, and a short numbered list. The blankness is the feature — it signals that this is a place you can leave whenever you want.

### Progressive disclosure, all the way down

You're never shown more than you asked for. Lead → summary → concept chip → "tell me more" → ask a question. Each layer is one tap deeper, and you control how far you go. A headline can be the whole experience, or the start of twenty minutes of reading. Both are fine.

### It reads like paper, not like an app

The whole interface borrows from print. A warm cream background with a faint paper grain. **Lora**, a serif, for everything you read. **DM Mono**, a typewriter-ish monospace, for the small functional labels — dates, tabs, buttons — so the interface chrome stays visually separate from the writing. A single forest-green accent does all the work; there is no second color shouting for attention.

> The palette: Cream paper #f5f2ec, ink #1c1b18, one green accent #2a5a3c. That's the whole system.

### Respect the reader's intelligence — and their gaps

Concept chips solve a real tension: nobody knows every acronym, every minister, every treaty — but a glossary feels condescending and a wall of context is exhausting. Chips let you ask for exactly the background you need, inline, in the flow of reading, and then get on with it. The app quietly tracks what you've learned rather than quizzing you on it.

### The inbox makes volume physical

The stacked-paper bucket cards aren't decoration. The stack literally gets thicker as a bucket fills, so you *feel* the weight of forty unread work emails versus four auth codes before you read a single subject line. And the buckets are named the way you'd name them to a friend — not "Promotions" and "Updates," but the actual categories of your life.

## 04 — Build it yourself

### A prompt to make your own

Want to build something like this? Paste the prompt below into Claude Code (or Claude) and iterate from there. It captures the philosophy and the stack — then make it yours.

```
Build me an anti-overwhelm news reading web app called The Brief.

The core idea: it should open as a near-blank, calm page — no images,
no screaming headlines, no infinite feed. A reader can go as shallow
or as deep as they want. Reading the news should feel like reading one
quiet, well-set page, not scrolling a feed.

Stack:
- React + Vite frontend, deployed to Firebase Hosting (make it a PWA).
- Node + Express backend running as a single Firebase Cloud Function.
- Firestore for all storage.
- The Anthropic Claude API for all AI work — server-side ONLY, never
  from the browser.
- Vanilla CSS with CSS custom properties. Two Google Fonts: Lora (serif)
  for body and headlines, DM Mono (monospace) for UI labels and buttons.
- A warm cream paper background (#f5f2ec), dark ink text (#1c1b18),
  and a single forest-green accent (#2a5a3c). Add a faint paper grain.

Features:
- A masthead: the title, today's date, and the reader's location.
- Category tabs: World, India, the reader's city, plus up to 3 custom
  interest topics the reader can add themselves.
- A numbered list of ~8 story leads, each a single sentence. Tapping a
  lead expands a short, Claude-written summary. Nothing expands until
  asked.
- Inside each summary, embed "concept chips": tappable inline pills over
  names and terms. Tapping one opens a popover with a one-line Claude
  explanation, plus a "tell me more" link for depth. Track which concepts
  a reader has opened in a "what you learned today" list.
- Let a reader ask a free-text question about any story; answer it with
  Claude using that story as context.
- Let a reader "follow" a story over time.
- Auth via 6-digit email OTP (or Google sign-in). Store the session as a
  JWT in localStorage.

Architecture rules:
- Lock Firestore security rules to deny all direct client access. Every
  read/write goes through the Express function, gated by JWT middleware.
- Cache Claude-processed stories in Firestore with a short TTL, and cache
  concept explanations permanently, so repeat loads are fast and cheap.

Make the whole thing feel quiet, textual, and unhurried. Favor white
space and restraint over density. When in doubt, show less.
```

Tip: build the calm reading view first, get it deployed, then layer on chips, Q&A, and tabs one at a time.

## 05 — Check it out

### See it for yourself

The Brief is live, and the full source is on GitHub.

- Live app: the-b-590d2.web.app
- Source: github.com/rheakaru/theBrief
