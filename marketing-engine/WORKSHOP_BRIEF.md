# Marketing Engine — Workshop Brief & Teaching Guide

> Paste this whole document into Claude (or ChatGPT) as context. It explains the
> platform end-to-end so the model can walk a company through building their brand
> **ontology** and testing it in **calendar generation** and **content creation**.

---

## 0. What this tool is, in one breath

It's an **AI CMO in a browser**. A company signs in, and over ~15 guided minutes the
tool *learns their brand* — scraping their website, interviewing the founder, and
structuring everything into a reusable **ontology** (a machine-readable model of who
they are, who they sell to, and how they talk). Then it proves the ontology is useful
by doing real marketing work with it: generating a month of content, designing
post-ready creatives across multiple AI tools, and even proposing non-content
applications (cold outreach, partnerships, retention flows).

**The North Star of the workshop:** by the end, every company has (a) a brand ontology
they understand and can edit, and (b) a visceral sense that *building this context once*
lets an AI agent do a dozen marketing jobs well.

**Live URL:** https://compai-marketing.web.app

---

## 1. The core idea to teach: an "ontology" is reusable brand context

Most people think of AI marketing as "type a prompt, get a post." This tool teaches a
deeper idea: **if you invest once in structured context about your brand, every future
AI task gets dramatically better and faster.**

The ontology is that context. It has these layers:

| Layer | What it captures | Why it matters |
|---|---|---|
| **Brand playbook** | Logo, colors, fonts, product photos, tagline | Visual identity any creative tool can reuse |
| **Writeup** | What you sell, to whom, what makes you different | Positioning — the spine of every prompt |
| **Personas** | 4–6 real buyer archetypes (motivations, pain points, voice, objections) | Who content speaks *to* — the #1 differentiator |
| **Channels** | Where you're active + what you post on each | Shapes format and tone per platform |
| **Content buckets** | Recurring content rhythms ("Customer love Fridays") tagged Educate/Inspire/Entertain/Persuade | The repeatable engine of a calendar |
| **Entity library** | Collections (festivals, products, recipes…) full of specific entities | Concrete material so posts aren't generic |
| **Funnel + stack** | Current focus (awareness→retention) + tools they use | Tunes strategy and hand-off |

The teaching beat: *personas + buckets + entities are the magic*. Most brands skip
these and stay generic. This tool makes them effortless.

---

## 2. The AI CMO persona (how the agent behaves)

Throughout onboarding the agent acts like a **sharp CMO who is genuinely curious about
this one company**. It doesn't just collect form fields — it:

- **Parses rambling input** (typed or spoken) into clean structured data.
- **Reflects back** so the founder feels heard ("So what I'm hearing is…").
- **Pushes their thinking** with one pointed follow-up when an answer is vague.
- **Suggests proactively** — an underserved persona, an obvious channel, a bucket that
  fits their story.

It gets visibly smarter as it goes, because every step reads the full workspace context
built so far. *Encourage participants to talk to it like a new hire, not a form.*

---

## 3. The flow, page by page

### Page 1 · Workspace picker (`/`)
Sign in (Google or email). Create a **workspace** = one company's session, saved
forever so they can return. Multi-tenant: a whole room works in parallel, each in their
own workspace.

### Page 2 · Onboarding (`/onboarding`) — 7 guided steps
This is the heart. Each step is a card; finished steps collapse; a right-side rail shows
progress (1/7…). Everything autosaves and stays editable later.

1. **Website → Brand Playbook.** Paste a URL. The agent scrapes it live, narrating
   progress in a terminal-style feed ("✓ Got the logo… ✓ Extracted brand colors… ✓
   Found fonts… ✓ Collected 6 product images"). Results land in an **editable playbook**:
   remove/add colors, edit fonts, upload a logo or product photos manually. No website?
   "Set up manually" instead.

2. **Tell your CMO about the company.** A chat panel. Founder types *or* uses **🎙 voice
   input** to ramble freely. The CMO replies conversationally, asks a follow-up, drops 💡
   suggestions, and produces a polished **writeup** (editable) + inferred customer types.

3. **Who you sell to (Personas).** Same interview pattern — describe customers out loud;
   formal **persona cards** appear below, fully inline-editable. The CMO pushes: "Who
   should be buying but isn't yet?" Can also add personas manually.

4. **Where you show up (Channels).** A 12-channel toggle grid. Or click **"🧠 Where
   should we focus?"** and the CMO pre-selects its picks (badged "CMO pick") with
   suggested post types per channel.

5. **Content buckets.** Tell the CMO what content you can *sustain*; it designs a
   balanced weekly mix (Educate/Inspire/Entertain/Persuade). Buttons: **"✨ Just propose
   a full mix"** (with a live loading status) and **"+ Add my own bucket"**.

6. **Funnel + stack.** One-tap funnel focus (Awareness → Retention) + current tools.

7. **Review & generate.** A scoreboard (X personas, Y channels, Z buckets, N brand
   colors, content-library items). The **content library auto-builds in the background**
   from the buckets — no manual entity step. Two exits: "Open ontology editor" or
   **"Generate my month →"**.

### Page 3 · Ontology editor (`/ontology`) — 6 tabs
Everything from onboarding, now in a clean tabbed editor: **Personas · Channels ·
Buckets · Entities · Style · Settings**. Card grids for entity-like data, drawers for
editing, and the same AI helpers reachable from each tab (re-draft personas, suggest
more buckets, generate entities, extract style from uploaded references). This is where
they refine before — or after — generating content.

### Page 4 · Calendar (`/calendar`)
One month of content, generated from the ontology. Hit **"✨ Generate this month"** →
a progress bar narrates the stages over ~90s (it survives switching pages; a floating
pill tracks it everywhere). The result is a real calendar grid, color-coded by bucket
function. Each slot has a date, platform, format, hook, angle, persona, and narrative
**arc** (posts build into multi-day storylines, not random one-offs).

- Click any slot → drawer to **edit** it or **"✨ Turn into full post"** (caption,
  hashtags, script, CTA, visual direction).
- Not feeling it? **"↻ Regenerate with feedback"** — type notes ("too many educational
  posts, make every Friday a customer story, build up to our launch on the 24th") and
  the CMO regenerates the month with your notes baked in.

### Page 5 · Studio / Design (`/design`)
Pick a slot, then either:

- **⚡ Make it post-ready (one click).** The CMO picks the right tool itself (reel →
  HeyGen avatar video with voiceover + captions; static → Nano Banana image in the
  brand palette), and assembles media + caption + hashtags + CTA in one panel. Save it.
- **🔬 Compare all 6 tools.** Same brief, six tailored outputs side by side:
  **Nano Banana** (image), **Claude** (HTML poster), **ChatGPT** (caption pack),
  **Veo 3** (shot-by-shot video script w/ VO + audio), **Higgsfield** (camera-motion
  brief), **HeyGen** (avatar script). Four render live in-app; all are copyable with an
  "open tool" link. *This is the wow moment: one idea, six platforms, visibly different
  strengths.* Capped at **3 creatives** per workshop session.

### Page 6 · Apply (`/apply`) — the portability payoff
Click **"✨ What else can this brain do?"** and the CMO points the *same ontology* at a
**non-content** marketing task picked specifically for this company — e.g. a cold-email
system to a named persona, partnership/collab targets, a WhatsApp retention flow, an
offline activation. It returns a 4–6 step system design, a **fully-written sample
artifact** (e.g. a 3-email sequence with subject lines), and a "how your ontology shaped
this" section. *Teaching beat: the context you built for social content just did a
totally different job — that's the real value of an ontology.*

### Page 7 · Export (`/export`)
The take-home. **Download a JSON** of the entire workspace (ontology + calendar +
creatives + applications) and **copy a Markdown "AI agent brief"** — a clean summary they
can paste into any AI tool to keep working. Confetti on first export. Everything is
stamped `schema_version: 1` so they can return and re-export.

---

## 4. How the ontology powers the outputs (the dependency chain)

Teach this explicitly — it's the whole point:

```
Brand playbook ─┐
Writeup ────────┤
Personas ───────┼──►  CALENDAR     (slots reference personas, buckets, entities,
Channels ───────┤      generation   real dates, narrative arcs)
Buckets ────────┤
Entity library ─┤──►  CONTENT      (turn-into-post + one-click creative pull the
Style refs ─────┤      creation     brand palette, voice, and a specific entity)
Funnel + stack ─┘──►  APPLY         (non-content systems built from the same context)
                          │
                          └──►  EXPORT  (the whole brain, portable JSON + brief)
```

Every downstream feature reads the same "company brief" object. **Better ontology →
better everything.** When a calendar feels off, the fix is usually upstream in the
ontology (a missing persona, a vague writeup), not in the calendar itself.

---

## 5. Workshop facilitation script (suggested ~150 min)

1. **(0–10) Framing.** "We're going to teach an AI agent your brand once, then watch it
   do a month of marketing work." Sign in, create a workspace.
2. **(10–55) Build the ontology.** Walk steps 1–7. Push them to *talk* to the CMO (use
   voice), not rush the forms. Emphasize personas and buckets.
3. **(55–70) Refine.** Tour the Ontology editor; fix one persona, add one bucket.
4. **(70–100) Generate the calendar.** Hit generate, explain arcs while it runs, then
   read 2–3 slots aloud. Use "Regenerate with feedback" once so they see it *listen*.
5. **(100–135) Create content.** One ⚡ one-click creative, then 🔬 compare all six tools
   on a juicy slot — the platform-difference reveal.
6. **(135–150) Apply + Export.** Run the Apply page (portability aha), then everyone
   exports their JSON + brief. End on the confetti.

---

## 6. Concepts participants ask about (have answers ready)

- **"What's a persona vs. a customer type?"** Customer types are rough notes ("parents,
  small businesses"). Personas are fleshed-out archetypes with motivations, voice, and
  objections — what the AI actually writes *to*.
- **"What's a content bucket?"** A repeatable theme you can run forever ("Founder honesty
  posts every Tuesday"). Buckets keep a calendar balanced and on-brand instead of random.
- **"What are entities?"** The specific things your content is *about* — actual festivals,
  products, recipes, customer stories. The tool auto-builds a library from your buckets so
  posts reference real things, not vague categories.
- **"Why does this beat just prompting ChatGPT?"** Because the ontology is reusable
  context. One good prompt is disposable; an ontology makes *every* future prompt better
  and is portable to any tool (that's what the Export brief is for).

---

## 7. Known limits / honesty notes for the room

- **5-minute-ish AI steps.** Calendar generation ~90s; HeyGen video ~30–90s. Progress
  bars cover this; it survives navigating away.
- **3 creatives per session** (workshop cost guardrail). One month of calendar only.
- **Veo & Higgsfield are prompt-only** (no live render); Nano Banana, Claude, ChatGPT,
  HeyGen render live in-app.
- **Voice input** uses the browser's speech API — best in Chrome.
- Everything is **editable forever** and saved to the workspace; participants can return.

---

## 8. How to use THIS brief with Claude during the workshop

Tell Claude: *"You are my co-facilitator for a workshop using the Marketing Engine tool
described above. Help me (a) explain each concept simply to non-technical founders,
(b) coach a participant whose [persona/bucket/calendar] feels weak by asking the same
sharp questions the in-app CMO would, and (c) interpret their exported JSON brief to
suggest next steps. Keep it warm, concrete, and tied to their specific business."*
