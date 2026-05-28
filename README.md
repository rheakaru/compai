# Throughline

**Paste a company URL. Get an evidence-backed structural diagnosis.**

Throughline (codename `compAI`) is a public, self-serve diagnostic tool for businesses. It reads what a company has put into the world — site, posts, press, hiring — and returns a structural reading: where the company sits on a 9-axis ontology, what's typically hard for a company shaped like that, and (with more input) which solved-domain analogies actually transfer.

It is built as the lead-gen surface for an AI-workshop consulting practice. The credibility of the free read **is** the conversion mechanism, so the product is engineered to fail honestly rather than pad — a fabricated read negatively qualifies the lead.

Live: a single text box. You paste a URL, watch the agent stream its work, and end up at a permalink profile you can correct, share, or export.

---

## What it does, in one screen

1. **Paste a URL.** Anonymous, no signup.
2. **Watch the read happen.** The server streams research events (web search → claim → axis position → problem map) over SSE. Every claim shows up with a **provenance badge** — `found_on_site`, `inferred_public`, `agent_hypothesis`, or `user_provided`.
3. **Get the diagnosis.** A position on 9 structural axes (e.g., margin shape, scale of network, decision cadence). The axis vector then *computes* a weighted hot/dormant problem map via the ontology's consequence rules — the problems are derived, not guessed.
4. **Correct it.** Low-confidence axes show two candidates and a disambiguating question instead of guessing. Your corrections sharpen the read visibly and are kept as an append-only event log.
5. **Go deeper.** Add your stack and 5 representative projects to unlock nearest-neighbour matches in the 9-D space — transferable solutions from solved domains, gated by a strict analogy-quality floor (above the floor → show clean; below → honest stop, no middle band).

---

## Why it's built this way

Most "AI tells you about your business" tools fabricate completeness. Throughline's central bet is the opposite: **honest degradation beats padded completeness**, especially when the output is a sales surface. So a few invariants are non-negotiable, and the rest of the architecture falls out of them.

- **Provenance on every claim.** No claim is shown naked — you always see where it came from.
- **Descriptive, never corrective.** The tool never tells a company it is "positioned wrong." It says: here's your shape, here's what's typically hard for this shape, here's where you deviate.
- **Agent derives, user corrects.** Low-confidence reads expose their candidates and ask, instead of guessing and flagging.
- **Append-only event log.** Profiles are *computed on read* from non-superseded claims. Nothing is overwritten. The trajectory is the product.
- **Analogy quality floor.** A strict similarity threshold. Above it: a clean, unhedged analogy. Below it: no analogy at all, and an honest pitch for a working session instead. No middle band, ever.
- **Server-side LLM.** The Anthropic key never reaches the browser. All model calls go through Next.js route handlers.

---

## Architecture spine

1. A company is a **position vector across 9 structural axes**, defined in [`ontology.yaml`](./ontology.yaml) (versioned, hand-editable, git-diffable — the ontology is the moat asset).
2. The axis positions **compute** the weighted hot/dormant problem map via the ontology's consequence rules.
3. Nearest-neighbour matches in the 9-D vector space surface transferable solutions from solved domains.

### Data model — append-only event log

```
companies/{id}
  ownerUid, sessionId, url, createdAt, ontologyVersionHash

companies/{id}/claims/{claimId}                APPEND-ONLY
  kind: fact | axis_position | hard_problem | analogy | one_liner
  provenance: found_on_site | inferred_public | agent_hypothesis | user_provided
  confidence
  supersededBy                                 (only mutation: null → claimId)

companies/{id}/corrections/{correctionId}      APPEND-ONLY
  type: wrong_about_company | wrong_about_reading
```

Funnel telemetry lives in a separate `funnelEvents/` collection — never smeared into claims. Anonymous `sessionId` rows are stitched to `ownerUid` on sign-in.

### Stack

- **Frontend:** Next.js 15 App Router, React 19, TypeScript, Tailwind.
- **Backend:** Next.js route handlers (Node runtime) for the streaming research endpoint and server actions.
- **LLM:** Anthropic API with built-in web search, streamed as NDJSON events.
- **Persistence + auth:** Firebase (Firestore + Auth, anonymous + Google).
- **Hosting:** Firebase App Hosting (auto-deploys on push to main; 300s timeout for streaming research).

---

## Repository layout

```
app/
  page.tsx                          landing (server → loads ontology → client)
  c/[companyId]/page.tsx            permalink profile (SSR from Firestore)
  api/research/route.ts             streaming SSE endpoint
  admin/funnel/                     operator-only funnel dashboard
  invite/                           role-layer invitee surface
components/
  LandingClient.tsx                 input + SSE consumer
  Profile.tsx                       one-liner + axes + problem map
  AxisCard.tsx / EditableAxisCard   one axis with evidence + low-conf candidates
  ProblemMap.tsx                    hot/dormant problems
  AnalogyAndProjects.tsx            5-projects + analogy floor display
  ProvenanceBadge.tsx               one badge per provenance kind
  ContextGraph/                     relational graph of facts
  Tour/                             onboarding overlay
lib/
  ontology/                         loader + version hash for ontology.yaml
  model/                            claims, projection (computeHardProblemMap), analogy floor
  agent/                            prompt build, research stream, persist
  firebase/                         client / admin / session
  funnel/                           telemetry helpers (separate collection)
  gate/                             Gate 1 / Gate 2 commit logic
  role/                             invitee/inviter role layer
scripts/
  set-operator-claim.ts             grant operator: true via Admin SDK
  verify-*.ts                       offline acceptance scripts
ontology.yaml                       THE moat asset
firestore.rules                     per-ownerUid, append-only enforced
apphosting.yaml                     App Hosting runtime + secret bindings
```

---

## Local development

```bash
npm install
cp .env.local.example .env.local        # then fill in (see below)
npm run dev                              # http://localhost:3000
```

### `.env.local`

```bash
# Public Firebase config — ships to the browser by design.
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Server-only secrets. Never exposed to the browser.
FIREBASE_ADMIN_CREDENTIALS={...service-account JSON, single line...}
ANTHROPIC_API_KEY=sk-ant-...
```

To turn a service-account JSON into the single-line value:

```bash
node -e "console.log(JSON.stringify(require('./path/to/service-account.json')))"
```

### Grant yourself operator

The operator role (sees `/admin/funnel`, edits the ontology) is a Firebase Auth **custom claim**, not a hardcoded email.

```bash
npm run set-operator -- you@example.com
# user must sign out and back in for the claim to land in their token
```

---

## Deploying to Firebase App Hosting

```bash
firebase login

# One-time
firebase apphosting:secrets:set ANTHROPIC_API_KEY
firebase apphosting:secrets:set FIREBASE_ADMIN_CREDENTIALS
firebase apphosting:backends:create --project <your-project>

# Push security rules
firebase deploy --only firestore:rules

# Push to main — App Hosting auto-deploys.
git push origin main
```

`apphosting.yaml` sets a 300s timeout for the long-running research stream, scales to zero, and binds secrets at runtime (they are not present in the repo).

---

## A note on the Firebase Web API key in the repo

You'll see a `NEXT_PUBLIC_FIREBASE_API_KEY=AIza...` value in `.env.local.example` and `apphosting.yaml`. This is intentional. The Firebase Web API key is shipped to every browser that loads the site — it is an *identifier* for the project, not a secret. Security is enforced by [Firestore security rules](./firestore.rules) and the API-key referrer restrictions configured in GCP. See [Firebase's own guidance](https://firebase.google.com/docs/projects/api-keys) for the long version.

The two values that *are* secret — the Firebase Admin service-account JSON and the Anthropic API key — live only in `.env.local` (gitignored) locally and in App Hosting's secret manager in production.

---

## License

MIT. See [LICENSE](./LICENSE).
