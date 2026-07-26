---
title: An AI CMO that learns your brand
dek: Build a brand's whole marketing brain in 15 minutes — a field note from my AI workshops.
tags: ai-workshops, marketing, brand-ontology, claude
source: https://rheakaru.github.io/projects/ai-cmo.html
---

An AI CMO that *learns your brand*.

I run hands-on AI workshops for companies. The hardest idea to land is that AI marketing isn't "type a prompt, get a post" — it's **building reusable context once** so an agent can do a dozen marketing jobs well. So I built a tool that proves it: it interviews a company, structures everything it learns into a *brand ontology*, then uses that ontology to plan a month of content, design creatives across six AI tools, and tackle marketing work beyond content entirely.

Built & designed by **Rhea Karuturi** — CTO & co-founder of Hoovu Fresh, and I teach companies to build with AI.

- Brand playbook
- Personas
- Channels
- Content buckets
- Entity library
- Funnel + stack

## The one idea

### An ontology is reusable brand context

Most people meet AI marketing as a vending machine: prompt in, post out. This tool teaches the deeper move — invest once in a structured model of who you are, who you sell to, and how you talk, and **every future task gets better and faster**. That structured model is the ontology. Build it once; point it anywhere.

- **The ontology** — Brand, personas, channels, buckets, entities
- **Calendar** — A month of slots, with story arcs
- **Creatives** — Post-ready, across six tools
- **Apply** — Outreach, partnerships, retention
- **Export** — Portable JSON + a brief for any AI

Everything downstream reads the same brief. Better ontology → better everything.

## Watch it run

### A two-part walkthrough

Me taking the tool end to end — first building a brand's ontology from scratch, then generating the calendar and creatives from it.

- Part 1 — building the brand ontology
- Part 2 — calendar & content generation

## 01 — The walkthrough

### What it does

The whole experience is one guided conversation that gets visibly smarter about *this one company* as it goes. Seven steps to build the ontology, then four pages that put it to work.

#### Build the ontology · ~15 min

**Website → brand playbook** — Paste a URL. The agent scrapes it live — narrating "got the logo… extracted the colors… found the fonts… collected the product shots" — and hands back an editable playbook. No site? Set it up by hand.

**Talk to your CMO** — A chat panel. Ramble out loud (voice input) or type. The agent parses the mess into a clean positioning writeup, reflects it back, and asks one sharp follow-up.

**Personas** — Describe your customers; formal persona cards appear — motivations, voice, objections — all editable. The CMO pushes: "Who should be buying but isn't yet?"

**Channels** — Toggle where you're active, or ask the CMO where you *should* be. It pre-picks and explains what to post on each.

**Content buckets** — Recurring rhythms — "Customer love Fridays", "Founder honesty posts" — balanced across Educate / Inspire / Entertain / Persuade. Suggested or hand-added.

**Funnel + stack** — One tap for this season's focus (awareness → retention) and the tools you already use.

**Review — and a library builds itself** — A scoreboard of everything captured. In the background, the agent quietly assembles a *content library* of specific entities from your buckets, so posts reference real things, not vague categories.

#### Put it to work

**Generate the month** — One month of slots, color-coded by bucket, built into multi-day narrative arcs. Don't like it? Regenerate with feedback and the CMO bakes your notes in.

**Design the creatives** — One click turns a slot into a post-ready creative in your brand language — the agent picks the tool itself. Or compare the same brief across six AI platforms side by side.

**Apply it beyond content** — Point the same brain at a non-content job — a cold-outreach system, partnership targets, a retention flow — and it designs the system *and* writes a ready-to-use artifact.

**Take it home** — Download the whole workspace as JSON, plus a Markdown brief you can paste into any AI tool to keep working.

An excerpt from the onboarding interview:

> **AI CMO:** I read your site — looks like fresh flowers for daily puja, delivered same-day. Tell me in your own words: who actually pays for this, and what makes them pick you over the corner vendor?
>
> **User:** honestly it's mostly the moms, 45 plus, they order weekly and never stop. they care that it's fresh and on time for the morning pooja…
>
> **AI CMO:** That's a retention goldmine — a weekly habit with near-zero churn. I've drafted her as a persona. One push: who's the **harder** sale you wish you could win? Young professionals who'd love this but think it's their parents' thing?
>
> Suggested persona — "The reluctant inheritor", 28–35

The onboarding isn't a form — it's an interview. You can talk; it structures.

## 02 — Under the hood

### How I built it

Deliberately boring infrastructure so the intelligence could be the interesting part. No build step, no framework — just static files, a database, and one smart function.

**Frontend**

- Plain HTML + vanilla JS, zero build step
- One shared stylesheet, a small `MKT` helper for CRUD + UI
- Voice input via the browser's `SpeechRecognition`

**Data**

- Firebase Realtime Database
- Every company is a `workspace` — all data scoped under it
- Storage for uploaded logos & assets

**Intelligence**

- `Claude Sonnet` is the CMO brain — interview, calendar, design briefs, apply
- One system prompt, fed the live workspace context every turn

**Backend**

- A single Cloud Function that switches on an `action`
- Long jobs persist results server-side, so they survive you closing the tab

**Multi-tool studio**

- The compare view fans the same brief out to image, video & chat models
- A Claude-rendered HTML slide as a never-fail fallback

**Discipline**

- Live progress bars on every slow step
- Creatives auto-save the moment they're made
- Everything stays editable, forever

The scrape narrates itself, then hands back a playbook you can edit — add a colour, swap a font, upload your own assets.

## 03 — The moments that land

### Where skeptics turn

Three beats do the convincing in a workshop: the agent *understanding* their brand, the leap from idea to finished creative, and the realisation that this context is portable.

**Understand — It sees the company the way they wish their agency did**

- Parses a rambling voice answer into clean structure
- Surfaces a persona or angle they hadn't named
- Reflects their brand back so it feels known, not processed

**Automate — From a month of slots to a finished post in one click**

- The agent picks the right tool for the format itself
- Reels come back with voiceover and captions baked in
- Statics use the brand palette and fonts automatically

**Compare — One idea, six tools, six different outputs**

- Nano Banana, Veo, Higgsfield, HeyGen, Claude, ChatGPT
- Each gets a brief tuned to its strengths
- Video tools get a real shot-by-shot script, not a vibe

**Port — The same brain, pointed at a different job**

- Proposes a non-content play specific to the company
- Designs the system *and* writes the first artifact
- Shows exactly which part of the ontology shaped it

A month with real story arcs (not random posts), and the studio that turns any slot into finished work.

## 04 — The design thinking

### Principles I kept coming back to

**P01 — Context once, reuse everywhere**

The ontology is the product. Features are just lenses on it. **Here:** calendar, design and apply all read one brief object.

**P02 — Talk, don't fill forms**

People describe their business better out loud than in fields. **Here:** voice input + an agent that structures the mess.

**P03 — Show the work**

Invisible AI feels like nothing happened. Narrate it. **Here:** the scrape feed and live progress bars.

**P04 — Never lose what they made**

A workshop demo can't depend on remembering to save. **Here:** creatives auto-persist; jobs survive a closed tab.

**P05 — The agent has a point of view**

A CMO that only takes dictation is a clipboard, not a hire. **Here:** it pushes back and suggests what you missed.

**P06 — End with something portable**

The value should outlive the session. **Here:** export a JSON + a brief any AI tool can read.

## 05 — Build your own

### The prompt I'd hand you

The best way to understand this is to build a version yourself. Open Claude Code in an empty folder and paste the prompt below. It describes the architecture, the ontology data model, and the flow — enough for Claude to scaffold a working version you can shape from there. Swap in your own API keys; never commit them.

#### Before you paste

You'll need a **Firebase project** (Auth + Realtime Database + Storage + Cloud Functions), an **Anthropic API key** for the agent, and — optionally, for live media — keys for whichever of Gemini / OpenAI / HeyGen you want to wire up. The prompt treats all of these as placeholders.

**One honest note:** media models cost real money per render and most need billing enabled. Start with text + a Claude-rendered HTML slide (both cheap and reliable), then add image/video tools once the core works.

Paste into Claude Code:

```
# Build a multi-tenant "AI CMO" marketing ontology tool.

GOAL
A web app where a company signs in, spends ~15 guided minutes letting an AI
agent learn their brand, and ends with a reusable "brand ontology" the same
agent then uses to generate a content calendar, design social creatives, and
propose non-content marketing systems. Built for live workshops: warm, calm,
hand-holding, with time hints and visible progress on every slow step.

STACK (match exactly — no frameworks, no build step)
- Frontend: vanilla HTML + JS, one shared CSS file. Pages are plain .html.
- Auth: Firebase Auth (email/password + Google).
- DB: Firebase Realtime Database (NOT Firestore). v8 client SDK from CDN.
- Storage: Firebase Storage for uploaded logos/assets.
- Functions: ONE Firebase Cloud Function (v2, Node 20) that switches on
  payload.action — keeps the deploy unit tiny.
- AI: Claude (claude-sonnet-4 family) for ALL text/reasoning. Read the key from
  an env/secret, never hardcode. Optional media: Gemini image, HeyGen video.

DATA MODEL — everything scoped by workspace (one company = one workspace)
Workspaces/{id}/
  meta: { name, workshop_stage }
  intake: { writeup, customer_types, funnel_focus, marketing_stack, brand:{logo,palette,fonts,assets,tagline} }
  personas/{slug}        # name, age_range, motivations[], pain_points[], voice_to_use, sample_objection
  channels/{slug}        # platform, handle_url, what_we_post, active
  buckets/{slug}         # name, function (Educate|Inspire|Entertain|Persuade), frequency, description
  entityCollections/{slug} + entities/{collection}/{slug}   # the content library
  calendar/{YYYY-MM}/{slot}   # date, platform, format, hook, angle, persona, bucket, arc
  creatives/{slot}            # the designed outputs

THE AGENT — an "AI CMO" with a real marketing brain
Every AI call is fed a compact "company brief" assembled from the workspace.
A single conversational action should: (1) parse messy/voice input into clean
structured data for the current step, (2) reflect it back, (3) ask ONE sharp
follow-up when something's vague, (4) proactively suggest what's missing.
Tone: warm, specific, never generic. It should feel like it's getting smarter
about THIS company as the session goes.

ONBOARDING — one page, 7 collapsing steps, a progress rail, autosave
1. Website -> brand playbook. A scrapeWebsite action fetches the homepage
   (use cheerio), pulls logo/colors/fonts/product images, and writes live
   progress to the DB so the UI can show "got the logo… extracted colors…".
   Result is an EDITABLE playbook; allow manual uploads too.
2. Company writeup — a chat panel with voice input (browser SpeechRecognition);
   the agent turns the ramble into a positioning paragraph.
3. Personas — interview -> editable persona cards.
4. Channels — toggle grid + an "where should we focus?" agent suggestion.
5. Content buckets — agent proposes a balanced mix; allow manual add.
6. Funnel focus + current tools.
7. Review — and silently generate an entity "content library" from the buckets.

OUTPUTS
- Ontology editor: tabbed view of everything above, all editable.
- Calendar: generate ONE month of slots from the ontology, with narrative arcs
  and bucket balance. IMPORTANT: set the model's max_tokens high (~20k) so the
  slot array doesn't truncate, and write a loose JSON parser with a salvage
  fallback for truncated responses. Let the user regenerate WITH feedback.
  Persist the result server-side + a job marker so it survives a closed tab,
  and show a progress bar.
- Design studio: pick a slot, then "one click" -> the agent picks the right
  tool for the format and returns a post-ready creative (caption + media;
  voiceover for video). Also a "compare 6 tools" view: same brief, tailored
  prompt per tool (image / video / chat). Always offer a Claude-rendered
  HTML-slide fallback so it never hard-fails. Auto-save creatives; cap at 3.
- Apply page: point the same ontology at a NON-content task (cold outreach,
  partnerships, retention). Return a system design + a ready-to-use artifact
  + which ontology pieces shaped it.
- Export: download the whole workspace as JSON + a Markdown "agent brief"
  the user can paste into any AI tool. Stamp it schema_version: 1.

WORKSHOP UX RULES
Time hints ("~90 sec"), demo-quality placeholders everywhere, friendly errors
(never raw stack traces), a visible "where you are / what's next" strip, and a
moment of payoff at export. Build it phase by phase: foundation + auth + one
AI action first, deploy, then layer the rest.

Start by scaffolding the Firebase project config, the shared CSS, the auth
gate, the workspace picker, and the Cloud Function skeleton with the
scrapeWebsite + agent-chat actions working. Then we'll build outward.
```

That's the real shape of it. The thing that makes it sing isn't any single feature — it's that one well-built context object quietly powers all of them. Get the ontology right and the calendar, the creatives, and the cold-outreach script all inherit the same taste.

> Teach the AI your brand once. Then watch it do a dozen jobs in your voice.

I built this to make one idea undeniable in a room full of skeptics: the leverage in AI isn't the prompt, it's the context you bring to it. A company that spends fifteen minutes building a real ontology walks out with a month of content, finished creatives, and a cold-outreach system — all of it sounding like them. And because it exports to a plain brief, the work doesn't die when the session ends. It's the start of how they'll use AI for everything after.

Vanilla JS · Firebase RTDB · Cloud Functions · Claude Sonnet · Multi-model studio · Voice input · Zero build step
