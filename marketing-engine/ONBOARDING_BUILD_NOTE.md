# Marketing Ontology Onboarding — Build Note

A portable spec for the AI-CMO-guided onboarding flow that turns a founder's website
+ a rambling interview into a structured "brand ontology" (personas, channels, content
buckets, entity collections, style). Hand this to Claude Code in another project to
rebuild the same pattern. Nothing here is compAI-specific except where noted.

Reference implementation in this repo:
- Frontend flow: `marketing-engine/code/onboarding.js` (7-step wizard)
- Shared data + AI layer: `marketing-engine/code/marketingCommon.js` (the `MKT` global)
- Backend AI actions: `functions/index.js` (single Cloud Function `marketingAI`)
- Export/serialize: `exportWorkspace()` in `functions/index.js`

---

## 1. The core idea

The onboarding is **not a form**. It's an interview run by an "AI CMO" that:
1. **Scrapes** the company website to seed a first draft (logo, colors, copy).
2. **Interviews** the founder step-by-step. Each answer can be messy voice-transcript
   text; the model **parses it into clean structured JSON** for the current step.
3. **Reflects, pushes, and suggests** — reflects back what it heard, asks ONE pointed
   follow-up, proactively proposes things the founder missed.
4. **Builds a library in the background** — after buckets are chosen it silently
   derives entity collections + entities, so the founder never sets those up by hand.

The output is a single **workspace document** in the DB that later powers everything
downstream (calendar, post generation, the exported markdown brief).

---

## 2. Data model (the "ontology")

One workspace per company. In this repo it lives in Firebase RTDB at
`Workspaces/{workspaceId}`, but the shape is DB-agnostic — reproduce it in
Firestore/Postgres/JSON just as easily. Shape:

```
Workspaces/{wsid}
  meta:      { name, slug, created_at, last_active, created_by, workshop_stage }
  members:   { <encodedEmail>: true }          // access control
  intake:    { writeup, customer_types, funnel_focus, marketing_stack,
               current_step, brand, website, ... }   // flat map, onboarding scratchpad
  personas:      { <slug>: { name, age_range, gender_skew, occupation,
                             location_archetype, motivations[], pain_points[],
                             where_they_hang_out[], voice_to_use, sample_objection } }
  channels:      { <slug>: { platform, handle_url, what_we_post, active } }
  buckets:       { <slug>: { name, function: Educate|Inspire|Entertain|Persuade,
                             description, frequency_count, frequency_per, why_this_helps } }
  entityCollections: { <slug>: { display_name, description, suggested_schema, icon } }
  entities:      { <collSlug>: { <slug>: { name, ...schema fields } } }   // nested by collection
  styleTemplates:{ <slug>: { palette[], mood[], prompt_hint } }
```

Conventions that matter:
- Every collection is a **map keyed by slug**, not an array. Slug = `slugify(name)`.
- Every doc carries `created_at` / `updated_at`.
- `intake` is the **resumable scratchpad**: it holds `current_step` and enough flags
  to recompute where the user left off (see resume logic below).
- Entities are **nested one level deeper** (`entities/{collectionSlug}/{entitySlug}`)
  because collections are dynamic per company.

---

## 3. The 7 steps

Defined declaratively as an array; each step has a `key`, a `render` fn, and the wizard
tracks `current`. (See `STEPS` in `onboarding.js`.)

| # | Step        | What happens                                                        |
|---|-------------|--------------------------------------------------------------------|
| 1 | brand       | Scrape website → seed brand (logo, colors, one-liner)              |
| 2 | writeup     | AI-CMO chat: founder describes the company; model parses → `writeup` + `customer_types` |
| 3 | personas    | AI-CMO chat / `draftPersonas` → 3–8 buyer personas                 |
| 4 | channels    | AI-CMO chat → where they post                                      |
| 5 | buckets     | `brainstormBuckets` → recurring content rhythms                    |
| 6 | funnel      | Pick funnel focus + marketing stack (simple form)                 |
| 7 | done        | Review; kick off calendar/library generation                       |

**Resume logic** (critical for a multi-session flow): on load, read `intake` + all
collections, then `pickResumeStep()` walks the steps in order and returns the first one
whose output is missing (`!intake.writeup` → step 2, `personas` empty → step 3, etc.).
`intake.current_step` is the explicit override. This makes the flow crash-safe and
re-entrant.

---

## 4. The AI-CMO interview turn (the key reusable primitive)

One backend action, `agentChat`, powers steps 2–4. Every turn is a **single stateless
model call** that returns strict JSON. The contract:

**System prompt** tells the model to, each turn:
1. PARSE whatever the founder said (may be messy voice transcript) into clean
   structured data for the current step.
2. REFLECT it back briefly ("So what I'm hearing is…").
3. PUSH: if vague/generic/missing, ask ONE pointed follow-up.
4. SUGGEST proactively: propose an angle they missed.

**Return shape** (always ONLY valid JSON):
```json
{
  "reply": "conversational message, 2-5 sentences, may include ONE question",
  "structured": { /* step-specific — partial/empty allowed if not enough info yet */ },
  "suggestions": ["short actionable suggestion", "..."],   // max 3
  "confidence": "low|medium|high"
}
```

`structured` is **per-step**, injected into the system prompt from a `STEP_SHAPES` map:
- writeup → `{ writeup, customer_types }`
- personas → `{ personas: [ {name, age_range, occupation, motivations[], ...} ] }`
- channels → `{ channels: [ {slug, platform, handle_url, what_we_post, active} ] }`
- buckets → `{ buckets: [ {slug, name, function, description, frequency_count, ...} ] }`

**The user-message payload** carries: a compact JSON of company context so far, the
current step name, the last ~10 turns of conversation, and the founder's raw input.
The client persists `structured` back into the workspace after each turn and appends
`reply` to the on-screen chat.

This one primitive (parse-messy-input → strict-JSON-for-current-step + a conversational
reply + suggestions) is the whole trick. Everything else is orchestration around it.

---

## 5. Backend: one function, action-routed

All AI runs through a single HTTPS function (`marketingAI`) that switches on
`payload.action`. Auth is a Firebase ID token (`Bearer` header) verified server-side.
Actions used by onboarding:

- `scrapeWebsite` — fetches the URL, extracts logo/colors/copy, writes **live progress**
  to the DB (`Workspaces/{wsid}/scrapeJob`) so the client can show "got the logo… got
  the colors…" in realtime. Reproduce with any polling/streaming channel.
- `agentChat` — the interview turn above.
- `draftPersonas` / `brainstormBuckets` / `brainstormCollections` /
  `brainstormEntities` — one-shot "give me N of X" generators. Same pattern: strict
  system prompt ("Return ONLY valid JSON…"), context in the user message, `parseJsonLoose`
  on the way out.
- `generateEntitiesFromBuckets` — runs **silently** after buckets are chosen; builds the
  content library with no user setup.

**Model call helper** (`callClaude`): thin wrapper over the Anthropic Messages API —
`{ model, max_tokens, system, messages }`, `anthropic-version: 2023-06-01` header,
concatenates `content[].text`. Model in this repo is `claude-sonnet-4-20250514`; for a
new project default to the current best model (e.g. Claude Sonnet 5 / `claude-sonnet-5`).

**Context builder** (`loadWorkspaceContext(wsid)`): reads the whole workspace and returns
a **trimmed** object (personas capped at 8, entity names sampled to 15, only the fields
the model needs). Every AI action reads this so prompts stay small and consistent. Build
the equivalent for your data source and reuse it everywhere.

**JSON robustness**: models occasionally wrap JSON in prose or fences. Use a
`parseJsonLoose` helper that strips ```` ```json ```` fences and grabs the out?ermost
`{…}`/`[…]` before `JSON.parse`. Don't trust raw `JSON.parse`.

---

## 6. Frontend data layer (`MKT`) — what to replicate

A small global object wraps all persistence + AI calls so pages stay thin:
- `slugify`, `uid`, `encEmail`/`decEmail` (email→DB-safe key), `escape`.
- CRUD: `getDoc/listDocs/saveDoc/deleteDoc` (collection maps), `getEntity/listEntities/
  saveEntity` (nested), `getIntake/saveIntake`, `saveMeta`. All auto-stamp timestamps
  and slugs.
- `callAI(action, payload)` — attaches the ID token, POSTs to the function, throws on
  non-2xx.
- Workspace resolution: `listMyWorkspaces` (filter by membership/creator),
  `createWorkspace(name)` (mints `slug + random suffix`, sets `meta` + `members`),
  `activateWorkspace(wsid)` (caches active ws id in `localStorage`),
  `ensureAccess()` (require sign-in, resolve active workspace or bounce to picker).
- `renderChrome`, `toast`, `drawer`, grid/form renderers — UI plumbing, swap for your
  own framework.

If you're rebuilding in React/Next instead of vanilla JS, this whole layer collapses
into a few hooks + API routes, but keep the **same method boundaries**: one `callAI`,
one context builder, per-collection CRUD, resumable intake.

---

## 7. The export / take-home (why the ontology is valuable)

`exportWorkspace()` reads the workspace and serializes it two ways:
1. A structured JSON bundle (`ontology`, `calendar`, `creatives`, `applications`).
2. A **markdown brief** (`brief_markdown`) — human- and LLM-readable: what the brand
   does, who they sell to, personas, channels, buckets, entity collections, style, and a
   "How to use this with an AI agent" footer. This is the artifact founders paste into
   Claude/ChatGPT to draft content. Keep this — it's the point of the whole exercise.

---

## 8. If rebuilding elsewhere — minimum checklist

1. Pick a store; model one workspace doc with the collection-map shape in §2.
2. Build `loadContext()` (trimmed) + `parseJsonLoose()` + a `callModel()` wrapper.
3. Implement the `agentChat` primitive with the 4-part system prompt + per-step
   `STEP_SHAPES` and the strict JSON return contract (§4).
4. Add one-shot generators (`draftPersonas`, `brainstormBuckets`, …) — same prompt discipline.
5. Frontend: declarative step array, per-step render, `pickResumeStep()` for re-entry,
   persist `structured` after each turn.
6. A background step that derives the content library from buckets.
7. A serializer that emits the markdown brief.

The non-obvious wins to preserve: **messy-input→strict-JSON parsing per step**,
**resumable intake**, **trimmed shared context object**, **silent library generation**,
and **the markdown brief as the deliverable**.
