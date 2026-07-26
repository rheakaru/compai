# Marketing Ontology Intake — Handoff Note

A portable spec for the **intake layer** only: how a founder's raw inputs (website URL,
voice, typed rambling) get turned into a clean, structured "brand ontology." Hand this to
Claude Code in another project to rebuild the same intake pattern. It is stack-agnostic —
the reference implementation is vanilla JS + Firebase + the Anthropic Messages API, but
nothing below depends on those choices.

Reference files in this repo:
- Front-end wizard + voice: `marketing-engine/code/onboarding.js`
- Backend AI actions (scrape, interview turn, generators): `functions/index.js`
- Fuller architecture note: `marketing-engine/ONBOARDING_BUILD_NOTE.md`

---

## 0. The one idea

Intake is **not a form**. It's an interview run by an "AI CMO." The founder gives messy
input three ways — a **website** (parsed automatically), their **voice** (spoken, live
transcribed), or **typed text** — and every turn the model does the same job: *parse the
mess into strict JSON for the current step, reflect it back, push with one follow-up, and
proactively suggest what they missed.* The three input modes all funnel into that single
primitive. Everything else is orchestration.

---

## 1. Three intake modes, one pipeline

| Mode | How it enters | What parses it |
|------|---------------|----------------|
| **Website** | Founder pastes a URL | `scrapeWebsite` — server fetches + extracts brand signals, seeds the first draft |
| **Voice** | Founder taps 🎙 and talks | Web Speech API → live transcript into the textarea → same `agentChat` call |
| **Text** | Founder types | Straight into `agentChat` |

Voice and text are **interchangeable** — voice just fills the same textarea the send button
reads from. The model is explicitly told the input "may be a rambling voice transcription,"
so it tolerates disfluency, repetition, and no punctuation. There is no separate "voice
parser"; the transcript is just text handed to the interview turn.

---

## 2. Website parsing (`scrapeWebsite`)

A server-side scrape that seeds the brand playbook so the founder starts from a draft, not
a blank page. Reference: `functions/index.js` → `scrapeWebsite`.

**What it does, in order (each step streamed to the UI — see §5):**
1. **Fetch homepage** — `fetch` with a browser UA, 12s abort timeout, `cheerio.load(html)`.
2. **Name + tagline** — `og:site_name` / `<title>`; `meta[name=description]` / `og:description`.
3. **Description** — first `<h1>` + first few `<p>` over 60 chars, capped ~1200 chars.
4. **Logo** — first match across `link[rel*=icon]`, `img[src*=logo]`, `img[class*=logo]`,
   `img[alt*=logo]`; falls back to `og:image`. All URLs absolutized against the base.
5. **Colors** — `meta[theme-color]` plus the most *frequent* `#rrggbb` hexes in inline
   `<style>` blocks (frequency-ranked, drops pure white/black), top 6.
6. **Fonts** — Google Fonts `family=` params + `font-family:` declarations, minus generic
   stacks (`sans-serif`, `system-ui`, …), top 5.
7. **Images** — `<img>` src/`data-src`, absolutized; classified as *product* (class/alt/src
   matches `product|shop|item|collection|cdn.shop`) vs *screenshot*; SVG/sprite/icon/pixel
   dropped. Caps: 8 product, 5 screenshots.
8. **About page (best-effort)** — follows the first `a[href*=about]`, 8s timeout, appends its
   paragraphs to the description for a richer writeup seed.

**Output** is a flat `brand` object: `{ logo_url, palette[], fonts[], product_images[],
screenshots[], tagline, description, company_name }`. The tagline + description are also
stored as `writeup_seed`, which pre-fills the *next* step's opening question ("I read your
website — here's my first take: …").

**Non-obvious choices worth keeping:**
- **Everything scraped is editable.** The playbook UI lets the founder add/remove colors,
  fonts, logo, assets. The scrape is a *starting guess*, never the source of truth.
- **Frequency-ranked colors** beat "first color found" — the most-repeated hex is usually
  the brand color, not a one-off.
- **Best-effort throughout.** A failed fetch, missing logo, or dead about-link degrades to
  "you can upload one" rather than erroring. There's always a "No website — set up manually"
  escape hatch that seeds an empty editable playbook.
- **No headless browser.** Plain fetch + cheerio gets ~80% of brand signal at a fraction of
  the cost/latency. Only reach for Playwright/Puppeteer if you must render JS-built sites.

---

## 3. Voice input (Web Speech API)

Reference: `onboarding.js` → `attachVoice(btn, textarea)`. ~25 lines, no dependencies.

- Uses `window.SpeechRecognition || webkitSpeechRecognition`. If absent, the mic button
  **hides itself** and the founder just types — graceful, no error.
- `continuous = true`, `interimResults = true` so text appears live as they speak; `lang`
  is set (`en-IN` here — set to your audience).
- Preserves whatever was already typed (`base`), then appends final + interim results, so
  voice and typing compose in the same box.
- Toggle button: tap to start (▶ "Speak" → ⏹ "Stop"), tap to stop; `onend`/`onerror` reset
  the button state.
- The transcript is **never sent anywhere on its own** — it's just text in the textarea that
  the normal Send button picks up. This is why voice needs zero backend.

**If you need better accuracy / non-Chrome / mobile:** swap this for a record-audio →
server-side transcription (e.g. an ASR API) step, but keep the contract identical — produce
text, drop it in the box, let the interview turn parse it. Don't build a separate voice path.

---

## 4. The interview turn (`agentChat`) — the reusable core

One stateless backend action powers every conversational step (writeup, personas, channels,
buckets). Reference: `functions/index.js` → `agentChat`.

**System prompt** = "You are the AI CMO for this specific company," then a fixed 4-part job
every turn:
1. **PARSE** the founder's (possibly messy voice) input into clean structured data for the
   current step.
2. **REFLECT** it back briefly so they feel heard.
3. **PUSH** — if vague/generic/missing, ask exactly ONE pointed follow-up.
4. **SUGGEST** — proactively propose an angle they missed (an underserved persona, an obvious
   channel, a bucket that fits their story). Max 3 suggestions.

**Strict return contract (always ONLY valid JSON):**
```json
{
  "reply": "conversational message, 2-5 sentences, may include ONE question",
  "structured": { /* per-step shape, partial/empty allowed if not enough info yet */ },
  "suggestions": ["short actionable suggestion", "..."],
  "confidence": "low|medium|high"
}
```

**`structured` shape is injected per step** from a `STEP_SHAPES` map, so one function serves
every step:
- `writeup` → `{ writeup, customer_types }`
- `personas` → `{ personas: [{ name, age_range, gender_skew, occupation, location_archetype,
  motivations[], pain_points[], where_they_hang_out[], voice_to_use, sample_objection }] }`
- `channels` → `{ channels: [{ slug, platform, handle_url, what_we_post, active }] }`
- `buckets` → `{ buckets: [{ slug, name, function, description, frequency_count,
  frequency_per, why_this_helps }] }`

**The user-message payload** carries, compactly: a trimmed JSON of company context so far
(name, writeup, persona names, channel names, bucket names, funnel focus), the current step
name, the last ~10 conversation turns, and the founder's raw input (capped ~8000 chars). If
`user_input` is empty, the model is told to *open* the interview with one sharp question —
so the same function both starts and continues the conversation.

**Client loop** (per turn): show the founder's bubble → show a "thinking…" placeholder →
`callAI('agentChat', …)` → replace placeholder with `reply` + suggestion chips → persist
`structured` back into the workspace immediately. History lives client-side and is replayed
into the payload each turn (stateless server).

> This single primitive — **messy input → strict JSON for the current step + a conversational
> reply + suggestions** — is the whole trick. Build this well and the rest is plumbing.

---

## 5. Live scrape progress (nice-to-have, high perceived value)

`scrapeWebsite` writes each step to `Workspaces/{id}/scrapeJob/steps` as it goes; the client
subscribes and renders "· Fetching homepage… ✓ Got the logo ✓ Extracted brand colors…" in
realtime. Makes a 10-second scrape feel like the CMO is *working for you*. Reproduce with any
push/poll/stream channel — the value is the narration, not the transport.

---

## 6. Robustness rules (don't skip these)

- **`parseJsonLoose`, never raw `JSON.parse`.** Models wrap JSON in prose or ```` ``` ```` fences,
  or get truncated at the token limit. The helper: strip fences → grab from the first `{`/`[`
  → try parse → on failure, walk back to the last balanced close → last resort, salvage a
  truncated array by closing open brackets at the last safe position. See `functions/index.js`.
- **Trimmed shared context object** (`loadWorkspaceContext`): every AI action reads one small,
  capped view of the workspace (personas ≤ 8, entity names sampled to 15, only needed fields)
  so prompts stay small and identical across actions.
- **Resumable intake.** Persist a `current_step` + enough flags to recompute where they left
  off; on load, walk the steps and jump to the first with missing output. Makes a multi-session
  interview crash-safe.
- **Everything the AI produces is editable** in the UI. The model drafts; the founder owns.
- **Merge, don't duplicate.** When re-parsing produces a persona/bucket with an existing name,
  merge onto the existing record (same slug) instead of adding a twin.

---

## 7. Minimum rebuild checklist

1. `scrapeWebsite`: fetch + cheerio extraction of name/tagline/logo/colors/fonts/images, all
   absolutized, all best-effort, streamed progress optional. Output an editable `brand` object
   and a `writeup_seed`.
2. `attachVoice`: Web Speech API → live transcript into the same textarea as typing; hide the
   button if unsupported.
3. `agentChat`: 4-part system prompt (PARSE/REFLECT/PUSH/SUGGEST) + per-step `STEP_SHAPES` +
   the strict JSON return contract. Stateless; history replayed each turn.
4. `parseJsonLoose` + a trimmed context builder, reused by every AI call.
5. Client: per-step render, persist `structured` after each turn, resumable `current_step`.

The non-obvious wins to preserve: **all three input modes collapse into one parse-to-JSON
primitive**, **scrape seeds but never dictates**, **voice is just text**, and **strict
per-step JSON with loose parsing on the way out**.
