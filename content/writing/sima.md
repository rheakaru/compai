---
title: Sima — Rank your beauty products. See what your friends love.
dek: Rank your beauty products. See what your friends love.
tags: beauty, social, react, firebase, claude, product-design
source: https://rheakaru.github.io/projects/sima.html
---

A side project · React + Firebase + Claude

Beauty advice is drowning in five-star reviews from strangers. Sima flips it: rank the products you actually use against each other, then surface what your real friends — and the people whose skin behaves like yours — keep reaching for. It's a beauty shelf, a ranked list, and a group chat in one.

Pairwise ranking · AI photo scan · Skin Twins · Mobile-first

## 01 — What it does

### A ranked, social second opinion on everything on your shelf.

You search or scan a product, decide how it stacks up against the others you own, and write a one-line verdict. Sima turns that into a living ranked list per category — and into a feed your friends can actually trust.

### Rank by comparison, not stars

Add a product and Sima asks "Which do you prefer?" against ones you've already ranked. A binary-insertion sort slots it into place. #1 becomes your Holy Grail; last place is flagged Regret.

### Scan a product with your camera

Point your camera at a bottle. Claude reads the label, identifies the product, brand and category, and runs the search for you. Mistyped a name? Claude suggests the "did you mean".

### Find your Skin Twins

During onboarding you pick your skin type, hair type, and concerns. Anyone who shares three or more concerns with you is tagged a Skin Twin — their reviews get surfaced first, because their skin behaves like yours.

### A feed of people you know

Home is your friends' activity — reviews, ranked products, uploaded looks, and linked Instagram / TikTok posts with the products tagged. No influencers, no ads. Just your council.

### A personal match score

Every product is tagged with the concerns it targets — derived from its ingredients. Sima compares those to your concerns and shows a match percentage, plus how many friends rank it.

### Reviews that mean something

Reviews are deliberately small: a sentence and a single honest toggle — would you repurchase? When you review something a friend has saved, they get a notification.

### A look inside

Built mobile-first, like a print magazine that happens to be an app.

## 02 — How I built it

### A lean stack: React on the front, Firebase on the back, Claude where it earns its keep.

No heavy framework, no design system off the shelf. The whole UI runs on a hand-rolled CSS utility layer and two Google fonts. The interesting work lives in the data model and the few places AI does something a regex couldn't.

- **Frontend — React 19 + Vite + React Router.** A single-page app, mobile-first at a 480px max width. Components are plain React with hooks — no state library.
- **Styling — Hand-written CSS tokens.** One stylesheet of variables, utilities, and components. Lora for body, DM Mono for labels, and a faint SVG grain overlay.
- **Auth + Data — Firebase Auth & Firestore.** Google sign-in. Firestore holds users, rankings, reviews, saved products, posts, friend requests, and a shared product cache — all locked down with ownership rules.
- **Media — Firebase Storage.** Uploaded looks live in Storage; Instagram and TikTok posts are embedded by URL via oEmbed, so there's nothing to host.
- **Serverless — Cloud Functions (v2).** Callable functions for product identification, query correction, and image search — plus a Firestore trigger that notifies friends when you review something they saved.
- **AI + Search — Claude + SerpAPI.** Claude (Sonnet) reads product photos and fixes fuzzy queries. SerpAPI's Google Images, scoped to Sephora / Ulta / Nykaa, fetches product shots and metadata.

### The scan-to-rank flow

Photo → Claude identifies product → SerpAPI image search → Tag concerns from ingredients → "Which do you prefer?" → Ranked list

### A couple of decisions I'm fond of

**Insertion sort as a UX primitive.** Ranking is just a binary search the user drives. Each "which do you prefer?" halves the candidates, so placing a product takes only a handful of taps even with a long list — and every answer is a genuine head-to-head, never an abstract star rating.

**Ingredients → concerns, locally.** A small keyword map turns an ingredient list into concern tags (salicylic acid → acne, niacinamide → acne, ceramide → dryness…). That powers the match score and concern filters without an extra API call.

A note on safety: every API key lives in Firebase Secret Manager and is read only inside Cloud Functions. Nothing sensitive ships to the browser or the repo — the public Firebase web config is locked to the app's domain.

## 03 — The design thinking

### Warm editorial minimalism — the opposite of a clinical beauty app.

Most beauty apps are either sterile lab-white or loud and gradient-soaked. I wanted Sima to feel like a well-set magazine: cream paper, ink type, one quiet green, and a little grain so nothing feels digital-perfect.

**i. Honesty over hype.** Rankings are relative and reviews are one toggle deep — "would you repurchase?". Stars invite inflation; a forced comparison and a yes/no can't be gamed.

**ii. Trust comes from similarity.** A glowing review from someone with opposite skin is noise. Skin Twins put people who share your concerns at the top, so advice actually transfers.

**iii. Nudge, don't nag.** Empty states use rotating, playful prompts and soft progress bars ("Best friends vs. blemishes") instead of red badges and guilt.

**iv. Editorial restraint.** Serif body text, monospace labels, generous whitespace, and exactly one accent colour. Personality lives in the words — "Holy Grail", "Regret", "Skin Twin" — not in the chrome.

### The palette

- Cream — #f5f2ec · paper
- Ink — #1c1b18 · text
- Forest green — #2a5a3c · the one accent
- Slate blue — #3d6b9e · links
- Amber — #9b6b2a · highlights

### The type

- Lora — Headings & body — serif
- DM Mono — Labels & meta — mono

## 04 — Build it yourself

### The prompt I'd hand an AI coding agent to recreate Sima.

Drop this into Claude Code (or your agent of choice) at the root of an empty folder. It captures the product, the stack, the data model, and the design language in one go. Tweak the retailers, concerns, and palette to make it yours.

```
// PROJECT
Build "Sima", a mobile-first social app for ranking beauty products and
seeing what friends actually love. Think Beli-for-skincare. Max width 480px.

// STACK
- React 19 + Vite + React Router (single-page app, hooks only, no Redux)
- Firebase: Google Auth, Firestore, Storage, Cloud Functions v2
- Anthropic Claude (Sonnet) for vision + text; SerpAPI for product images
- Plain hand-written CSS (no Tailwind): design tokens, utilities, components
- Keep every API key in Firebase Secret Manager, read only inside functions

// CORE LOOP
1. Onboard: pick display name, skin type(s), hair type(s), and concerns
   (acne, dryness, pigmentation, frizz, etc.) across skin / hair / body.
2. Find a product: text search OR snap a photo. A callable function sends
   the image to Claude -> {productName, brand, category}; another corrects
   fuzzy queries ("did you mean"). Image search hits SerpAPI Google Images
   scoped to (site:sephora.com OR site:ulta.com OR site:nykaa.com).
3. Rank: adding a product runs a binary-insertion sort driven by the user —
   show "Which do you prefer?" against the median of the current list and
   narrow until it slots in. #1 = "Holy Grail", last = "Regret". Per category.
4. Review: free-text + a single "would repurchase?" yes/no toggle.
5. Social: friend requests; a home feed of friends' reviews, ranked items,
   uploaded looks, and linked Instagram/TikTok posts (oEmbed) with products
   tagged. Two users sharing 3+ concerns are "Skin Twins" — surface them first.

// INTELLIGENCE
- Map ingredient keywords -> concern tags locally (salicylic acid->acne,
  ceramide->dryness, vitamin c->pigmentation...). No extra API call.
- Personal match score = % overlap of user's concerns and a product's tags.
- A Firestore onCreate trigger on reviews notifies friends who saved that product.

// FIRESTORE MODEL
users/{uid}, productCache/{id}, rankings/{uid}/categories/{cat},
savedProducts/{uid}/items/{id}, reviews/{uid}/items/{id},
posts/{uid}/items/{id}, notifications/{uid}/items/{id}, friendRequests/{id}.
Lock every collection to owner-writes with security rules.

// DESIGN — "warm editorial minimalism"
- Palette: cream #f5f2ec bg, ink #1c1b18 text, forest green #2a5a3c accent,
  slate blue #3d6b9e links, amber #9b6b2a highlights. Borders ~#d9d4cb.
- Type: Lora (serif) for headings + body; DM Mono for labels/meta (uppercase,
  letter-spaced). A faint SVG fractal-noise grain overlay at 4% opacity.
- Components: pill chips, underline tabs, stacked list rows, bottom tab nav,
  bottom-sheet modals. Italic muted placeholders. One accent colour only.
- Feel: a print magazine that happens to be an app. Calm, not clinical.

Scaffold the repo, write the code, and give me setup steps (.env.example,
firebase config, how to set the Claude + SerpAPI secrets).
```

### See it for yourself.

The live app, and the full source — rules, functions, and all.

- Live app: sima-c07b5.web.app
- Source: github.com/rheakaru/Sima
