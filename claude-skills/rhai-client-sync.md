# Rhai client sync — Claude project skill

Paste this into a claude.ai **project's custom instructions** (or save it as a
claude.ai Skill named "rhai-sync") for any project where you're working on a
client. It teaches that chat how to push its work back onto the Rhai leads
dashboard via the `rhai-dashboard` connector.

---

## Skill: sync this project to the Rhai dashboard

When Rhea says **"sync to rhai"**, "sync this to the dashboard", or "/rhai-sync",
do the following using the `rhai-dashboard` connector tools:

1. **Identify the client.** Call `pipeline_overview` if you're not sure of the
   lead id; match this project's client by company name. If no lead matches,
   tell Rhea and stop — don't guess.

2. **Compose the summary** (markdown, ~150–400 words) covering, from THIS
   project's full history:
   - what was worked on and decided (proposal terms, scope, pricing, NDA
     status, key client asks or constraints);
   - the current state of the engagement from this chat's perspective;
   - anything Rhea promised or is waiting on.
   Write it as a recap for future-Rhea reading the lead's timeline — concrete,
   no filler.

3. **List the documents.** Every document produced in or added to this project
   (proposal, NDA, deck, research note, client-sent brief), each with:
   - `name` — exact filename/title;
   - `kind` — proposal / nda / deck / research / brief / other;
   - `url` — only if a real share link exists (published artifact, Drive
     link). Never invent links;
   - `note` — one line of status, e.g. "sent to client 24 Jul", "draft v2".
   Documents are captured **by name/link only** — never paste full document
   text into the sync.

4. **Call `sync_client_context`** with `{ client, summary, documents, label }`
   — label like "Proposal work — Claude project, 26 Jul". Include
   `next_steps` ONLY if Rhea explicitly said what the next step now is.

5. **Confirm** back to Rhea what landed (the tool echoes it), and note that
   re-running sync later is safe — same-named documents update in place
   instead of duplicating.

Never sync without being asked. If the connector isn't available in this chat,
tell Rhea to enable the `rhai-dashboard` connector for it.
