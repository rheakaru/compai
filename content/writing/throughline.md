---
title: An honest structural diagnosis for businesses
dek: A self-serve tool that refuses to fake completeness. Paste a URL, watch the agent stream its work, and correct the read where it's wrong — that's the interesting part.
tags: throughline, build-log, ai-agents, nextjs, ontology
source: https://rheakaru.github.io/projects/throughline.html
---

Project: Throughline
Live: compai-web…hosted.app
Code: github.com/rheakaru/compai
Stack: Next.js 15 · Firebase · Anthropic
Status: Live, anonymous, free

## 01 What it does

Paste a company URL. You get an evidence-backed structural diagnosis: where the company sits on a 9-axis ontology, what's typically hard for a company shaped like that, and — if you give it your stack and a few real projects — which solved-domain analogies actually transfer.

It's not a tool that tells you what your company *is*. It's a tool that tells you what your *shape* is, and what tends to be hard for that shape. The difference matters. Most "AI tells you about your business" tools fabricate completeness — they pad until they fill the page, because the page expects to be filled. Throughline does the opposite. The product is engineered to fail honestly rather than pad.

> A fabricated read negatively qualifies the lead it's meant to attract.

You watch the agent stream its work in real time: web search → fact → axis position → problem map. Every claim shows up with a provenance badge — `found_on_site`, `inferred_public`, `agent_hypothesis`, or `user_provided`. No claim is shown naked. When the agent is unsure about an axis, it doesn't guess and flag — it surfaces two candidates and asks the one question that would disambiguate. Your corrections sharpen the read visibly, and they're kept forever as an append-only event log. **The trajectory is the product.**

It exists as the lead-gen surface for an AI-workshop consulting practice. The credibility of the free read is the conversion mechanism, which is the whole reason it has to refuse to fake it.

## 02 How I built it

### The architecture spine

Three sentences, in order:

- A company is a position vector across 9 structural axes, defined in a versioned YAML file (`ontology.yaml`) that lives in git, not in the database.
- The axis positions compute the weighted hot/dormant problem map via the ontology's consequence rules — the problems are *derived*, not guessed.
- Nearest-neighbour matches in that 9-D vector space surface transferable solutions from solved domains, gated by a strict analogy-quality floor.

That spine — vector → derive problems → nearest neighbour for analogies — is the whole thing. Everything else is plumbing.

### The moat asset is a YAML file

The single most important file in the repo is `ontology.yaml`. It's 600 lines, hand-edited, git-diffable, and contains: the 9 axes (CODP, demand uncertainty, value-chain position, cash conversion cycle, customer concentration, etc.), the consequence rules that map each axis position to a hot/dormant problem list, the declared interactions (compounding pairs of axes that produce hard problems neither axis explains alone), the analogy library, and one knob — `analogy_floor: 0.72` — that decides whether to show a transferable solution at all.

Every diagnosis records the SHA of the ontology version that produced it. That way the trajectory of a single company through your evolving ontology is recoverable: a year from now, you can ask "what changed in our read of this company, and was it the company or our model that moved?"

### Data model — append-only event log

The biggest call early was refusing to store profiles as documents. Profiles are *computed on read* from an append-only stream of claims (and corrections). Nothing is ever overwritten. The only mutation in the entire data model is the one-time `supersededBy: null → claimId` flip when a new claim replaces an old one.

```
companies/{id}/claims/{claimId}        kind, provenance, confidence, supersededBy
companies/{id}/corrections/{cId}       type: wrong_about_company | wrong_about_reading
```

Why bother? Because the interaction — the user correcting the machine and watching it sharpen — is the load-bearing experience. If you overwrite, you've thrown away the only data that explains your tool's behaviour to its user.

### Streaming agent, server-side

The research route is a Next.js App Router handler that calls the Anthropic API with web search enabled, streams NDJSON events back over SSE, and persists each event as a claim as it lands. The browser consumer renders claims into UI in real time. The Anthropic key never leaves the server — that's enforced architecturally, not by convention.

The system prompt is built from the ontology *at request time*, not hardcoded. So when I edit `ontology.yaml` and push, the agent's instructions change with it. The prompt's five non-negotiable rules — provenance on every claim, descriptive-never-corrective, agent-derives-user-corrects, no hallucinated completeness, plain English on every user-facing line — are the same five invariants the UI enforces. Single source of truth.

### The consequence engine (the bit I'm most proud of)

V1 of the consequence engine computed hot problems by looking up `consequence.<value>.hot` for each axis and concatenating. The result was generic — a single-axis vote sitting next to a brilliant deviation-aware one-liner, computed from different inputs and disagreeing with each other.

V2 blends three sources, with explicit weights:

- **Position** (weight 1.0) — what's typically hard for this shape.
- **Deviation** (weight 1.5) — where the company departs from typical for that axis.
- **Interaction** (weight 1.8) — declared compounding pairs (e.g. customer concentration × zero-slack cash conversion → "defend fill rate during demand spikes with no financial slack, against customers concentrated enough that any one failure is existential").

The blend is scored, modulated by the load-bearing rank of the dominant contributing axis, and emitted as a single ordered list with attribution — every hot problem can show which sources voted and which axes drove it. The invariant the code enforces: *the top hot problem must reconcile with the one-liner.* They read the same deviations and they must not disagree.

### The analogy floor

There is exactly one knob: `analogy_floor: 0.72`. It's a strict floor with no middle band. Above it: show the analogy clean — no hedge, no confidence label, no numeric score. Below it: don't show one at all; pitch the working session instead.

The temptation to add a "medium-confidence" tier is the temptation that kills the tool's signal-to-noise. I haven't given in.

### Stack

Next.js 15 App Router + React 19 + TypeScript + Tailwind. Firebase (Firestore + Auth, anonymous + Google). Anthropic API with built-in web search. Firebase App Hosting for deploy (auto-deploys on push to main; 300s timeout for the long-running research stream). One YAML file doing more work than any of them.

## 03 The invariants worth stealing

Pulled out as a list, because they're transferable to any "AI summarises something for a user" product.

### 01 Trust — Provenance on every claim, no exceptions.

The badge is non-negotiable. `found_on_site`, `inferred_public`, `agent_hypothesis`, `user_provided` — no claim is ever shown naked.

### 02 Tone — Descriptive, never corrective.

Never tell a company it is positioned wrong. Say: here's your shape, here's what's typically hard for this shape, here's where you deviate.

### 03 Uncertainty — Agent derives, user corrects.

Low-confidence reads expose their candidates and ask the one disambiguating question, instead of guessing and flagging.

### 04 Data model — Append-only event log.

Profiles are computed on read. The trajectory of how a read sharpens *is* the explanation the user needs.

### 05 Security — Server-side LLM.

The API key never reaches the browser. Architecture enforces it, not convention.

### 06 Honesty — Honest stop beats padded continuation.

If the floor isn't met, say so and pitch the conversation. The product is engineered to fail honestly rather than pad.

## 04 A prompt to build it yourself

If you wanted to spin up your own version of this — substitute your own domain (a structural diagnosis for restaurants, dev teams, novels, whatever) — here's a single prompt that should get you most of the way with any reasonably capable coding agent.

```
Build a Next.js 15 App Router app called Throughline. It is a public,
self-serve structural-diagnosis tool. The user pastes a URL on the
landing page and gets back an evidence-backed reading.

Spine. A subject (e.g. a company) is a position vector across N
structural axes defined in a hand-edited ontology.yaml at the repo
root. The axes' positions compute a weighted hot/dormant problem map
via the ontology's consequence rules. Nearest-neighbour matches in
the N-D vector space surface transferable solutions from solved
domains, gated by a single analogy_floor value with no middle band —
above the floor, show the analogy clean; below, an honest stop.

Data model. Append-only event log in Firestore.
  subjects/{id}/claims/{claimId} are immutable except for a one-time
  supersededBy flip. Profiles are computed on read from
  non-superseded claims, never stored. Every claim carries a
  provenance field:
    found_on_site | inferred_public | agent_hypothesis | user_provided

Streaming research route. A Next.js route handler (/api/research)
that calls the Anthropic API with web search enabled and streams
NDJSON events back over SSE. Build the agent's system prompt from
ontology.yaml at request time (so editing the YAML changes the
agent's instructions). The Anthropic key is server-only — never
expose it to the browser.

The five non-negotiable invariants the agent and UI must enforce
together:
  1. Provenance on every claim. No claim is ever shown naked.
  2. Descriptive, never corrective. Never tell the subject it is
     positioned wrong; say "here's your shape, here's what's
     typically hard for this shape."
  3. Agent derives, user corrects. When confidence on an axis is
     below 0.6, the agent emits two candidate positions and one
     disambiguating question — never a single guess with a "low
     confidence" flag.
  4. No hallucinated completeness. Empty categories are skipped,
     not invented.
  5. Plain English on every user-facing line. No domain jargon.

Auth. Anonymous sessions for the free tier (cookie-based sessionId).
Anonymous rows stitch to a ownerUid on sign-in. An operator role is
a Firebase Auth custom claim, not a hardcoded email.

Deploy. Firebase App Hosting with a 300s timeout to support the
streaming research route. Secrets bound at runtime via
  firebase apphosting:secrets:set.

Stub the ontology with 3 axes to start. Get one URL flowing all the
way through (paste → stream → axes → problem map → permalink)
before adding more axes. The ontology is the moat — grow it slowly,
one real case at a time.
```

If your agent comes back with a 10-tab dashboard and 80 unread axis cards on day one, throw away its work and tell it to start with one URL.

## 05 Try it

Paste any company URL. It's anonymous; no signup. Correct the read if it's wrong — that's the interesting part.
