# compAI

Public, self-serve structural-diagnosis tool for businesses. Paste a company URL, get an evidence-backed 9-axis read and the hot/dormant problem map computed from it. Built as the lead-gen surface for an AI-workshop consulting business — credibility of the free taste IS the conversion mechanism.

## Phase status

- **Phase 1 (shipped):** Anonymous Stage 0 — paste a URL, streamed research, 9 evidence-backed axis positions (with two-candidates + disambiguating question for low-confidence ones), computed hot/dormant problem map, computed one-liner, provenance badges, append-only Firestore claim log, ontology loaded from versioned YAML.
- **Phase 2 (next):** Gate 1 commit-not-intent corrections + "what changed" diff.
- **Phase 3 (next):** Gate 2 stack form + 5-projects + analogy quality-floor display.
- **Phase 4 (next):** Role layer with invitee/inviter views.

## Architecture spine

1. A company is a **position vector across 9 structural axes** (defined in `ontology.yaml`).
2. The axis positions COMPUTE the weighted hot/dormant problem map via the ontology's consequence rules.
3. Nearest-neighbour matches in the 9-D vector space (Phase 3) are the transferable-solution claim.

The data model is an **append-only event log of claims and corrections**; the profile is computed on read. Never overwrite. The trajectory IS the product.

```
companies/{id}
  ownerUid, sessionId, url, createdAt, ontologyVersionHash

companies/{id}/claims/{claimId}        APPEND-ONLY
  kind: fact | axis_position | hard_problem | analogy | one_liner
  provenance: found_on_site | inferred_public | agent_hypothesis | user_provided
  confidence
  supersededBy                          (only mutation allowed: null → claimId)

companies/{id}/corrections/{correctionId}   APPEND-ONLY
  type: wrong_about_company | wrong_about_reading
```

Provenance is shown on every claim. Hypotheses are visibly hypotheses, never asserted as facts.

## Local development

```bash
npm install
cp .env.local.example .env.local         # then fill (see below)
npm run dev                              # http://localhost:3000
```

### `.env.local`

The repo ships a generated `.env.local` already containing the dev keys. To regenerate from a service-account JSON:

```bash
node -e "console.log(JSON.stringify(require('./path/to/service-account.json')))" \
  > /tmp/sa.oneline
# paste into FIREBASE_ADMIN_CREDENTIALS in .env.local
```

Required vars:

- `NEXT_PUBLIC_FIREBASE_*` — client config, safe to ship.
- `FIREBASE_ADMIN_CREDENTIALS` — single-line JSON of the service-account file. **Server only**, never exposed to the browser.
- `ANTHROPIC_API_KEY` — server only.

## Grant yourself operator (custom claim)

The operator sees `/admin/funnel` and edits the ontology. Operator status is a Firebase Auth **custom claim**, not a hardcoded email.

```bash
npm run set-operator -- rhea@rosebazaar.in
# the user must sign out and back in for the claim to land in their token
```

## Deploy to Firebase App Hosting

```bash
# One-time
firebase login
firebase apphosting:secrets:set ANTHROPIC_API_KEY
firebase apphosting:secrets:set FIREBASE_ADMIN_CREDENTIALS

# Deploy security rules
firebase deploy --only firestore:rules

# Connect a backend (one-time)
firebase apphosting:backends:create --project compai-57d55

# Then push to your git remote — App Hosting auto-deploys on push.
```

`apphosting.yaml` sets a 300s timeout to support the long-running streaming research route, scales to zero, and binds secrets at runtime.

## Repository layout

```
app/
  page.tsx                          landing (server component → loads ontology → client)
  c/[companyId]/page.tsx            permalink profile page (SSR from Firestore)
  api/research/route.ts             streaming SSE endpoint (web search + persist + derive)
  globals.css
  layout.tsx
components/
  LandingClient.tsx                 input + SSE consumer; replaces URL on first event
  Profile.tsx                       one-liner + axes + problem map + facts
  AxisCard.tsx                      one axis with evidence, badge, low-conf candidates
  OneLiner.tsx                      sticky pinned line
  ProblemMap.tsx                    hot/dormant problems
  ProvenanceBadge.tsx               badge component, one per provenance kind
lib/
  ontology/
    types.ts                        Ontology, Axis, AxisPosition, Provenance, etc.
    loader.ts                       reads ontology.yaml + sha256 version hash
  model/
    claims.ts                       Claim / Correction / OpenQuestion types
    projection.ts                   computeHardProblemMap, projectFromClaims, cosine
    analogy.ts                      analogy-floor match logic (used Phase 3)
  agent/
    prompt.ts                       builds the research system prompt from ontology
    research.ts                     streams NDJSON events from Anthropic + web search
    persist.ts                      event → Claim → Firestore
  firebase/
    client.ts                       Web SDK init (browser only)
    admin.ts                        Admin SDK init (server only, gated by service account)
    session.ts                      anonymous session cookie management
scripts/
  set-operator-claim.ts             grant operator: true to a user
ontology.yaml                       THE moat asset, hand-editable, git-diffable
firestore.rules                     per-ownerUid security, append-only claims
firebase.json                       Firestore + App Hosting config
apphosting.yaml                     App Hosting runtime + secrets binding
```

## Non-negotiable invariants (the product breaks if these slip)

- **Provenance on every claim.** No claim is shown naked.
- **Descriptive, never corrective.** Never say a company is positioned wrong.
- **Agent derives, user corrects.** Low-confidence axes show two candidates + a disambiguating question; they never guess-and-flag.
- **No hallucinated completeness.** Padding is a defect, not a nicety.
- **Append-only event log.** Profiles are computed on read; never overwrite.
- **Anthropic key never reaches the browser.** All LLM calls are server-side.
- **Analogy quality floor (Phase 3):** above the floor → show CLEAN, below → HONEST STOP. No middle band, ever.

## Security note

Rotate the Firebase Admin service account and Anthropic API key after initial setup — both keys were shared in chat during development and should be treated as compromised.
