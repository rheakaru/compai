# Chief of Staff workshop — brief for building the presentation

Hand this to Claude with: "Build me the slide deck for this workshop. The session
outline is in section 1, the thing we built is in sections 2–4, and the demo
flow is in section 5. Keep slides sparse; the live demo carries the middle."

---

## 1. The session (what the deck has to carry)

Run by Rhea Karuturi (Rhai). Audience: ~150 founders and operators, mostly on
phones, mixed technical levels. The arc:

1. **Intro** — what this session is, how it is structured, what you leave with.
2. **Who I am** — Stanford; CTO of Hoovu Fresh for 7 years (B2B puja-flower
   supply chain across 9 cities, the AI running it was a weekend project);
   Shark Tank India; Rhai, the AI consulting practice; ~350-person "Hang w AI"
   community.
3. **What AI is** — the keywords people need and nothing more: model, prompt,
   context, tokens, tool.
4. **What's an agent?** — an LLM that can *do* things. Model + instructions +
   tools + memory, in a loop.
5. **How do we build an agent?** — where it is hosted (Firebase in our case)
   and how the information moves: WhatsApp → webhook → Firebase → the model →
   reply on WhatsApp.
6. **BREAK**
7. **Chief of Staff agent** — everyone builds one live (sections 2–5 below).
8. **SET UP TIME** — people finish their build and message it.
9. **Ways forward** — out-of-the-box options (Muse, Instinct, Dots); the
   exportable build kit for your own Claude Code; keep tuning this one.
10. **Beyond Chief of Staff** — an agent is not a human. It is on 24/7; it
    cannot be held accountable, so it cannot be trusted the way a person is.
    Don't digitise the role, rethink it from first principles.
11. **Try this with other roles** — every role is an outcome plus the tasks
    that get there. Agents take tasks; the person owns the outcome.

## 2. What we built, in one line

A public page at **heyrhai.com/chief-of-staff** where anyone signs in with
Google, is interviewed (by voice or text) by their own chief-of-staff-to-be,
reviews the brief it compiled, connects WhatsApp and optionally Google
Calendar + Gmail, and then talks to it on WhatsApp. Everyone in the room gets
their own agent on one shared Rhai WhatsApp number.

## 3. The six touchpoints (the teaching frame)

This is the structure the interview follows and the structure of every
agent's operating document. Use it as the spine of the "What's a chief of
staff?" section — it is what people are answering on their phones.

| Touchpoint | The question the agent asks | What it becomes |
|---|---|---|
| Role & objective | What should be true in a month because they exist? | The job and the success criterion |
| What they already know | Your world, priorities, the people that matter | Day-one context (plus a brief about you) |
| When they reach out | Morning brief? Only for decisions? Quiet hours? | Cadence rules |
| Tools | Calendar read/create, Gmail read, reminders — and what's off limits | Which tools are switched on |
| How they speak | Blunt, warm, formal, language mix, ask-first or just-do | Voice |
| Other rules | Always / never / check with me first; a name | Guardrails |

Design note worth saying out loud: the interview is *not a form*. One
rambling voice answer can fill four or five of these at once; the model
parses it, reflects it back in one line, and asks the next question. Same
pattern as the marketing ontology tool.

## 4. How it works (the architecture slide)

```
Phone (web page)                         WhatsApp
  sign in with Google                      person messages the Rhai number
  voice or text answers                            │
        │                                          ▼
        ▼                               Meta Cloud API → webhook (/api/whatsapp)
  /api/cos/interview                               │  verify signature, dedupe
  parse answer → patch spec ──► Firestore ◄────────┘  look up number → their agent
  compile agent.md                  │
        │                           ▼
        ▼                     the agent (Claude Opus) runs with agent.md
  review / edit / go live     + tools: calendar, gmail (read-only),
        │                       reminders, memory
        ▼                           │
  connect Google (OAuth) ──► refresh token stored server-side only
                                    ▼
                              reply on WhatsApp (or in the web console)
```

Points to make:

- **One brain, two doors.** The web console on the page and WhatsApp share
  the same agent and the same memory. What you try on the page carries over.
- **agent.md is the product.** The interview compiles into a plain-English
  operating document. You can read it, edit it by hand, and take it home.
  Rules and tools are text, not code.
- **Tools are gated twice.** By what the person switched on, and by whether
  Google is actually connected. If it isn't, the agent says so instead of
  guessing.
- **Memory.** The agent has a `remember` tool for durable facts (people,
  preferences, commitments). Not for chit-chat.
- **Proactive = reminders.** "Remind me at 6pm" writes a row; a cron fires it
  over WhatsApp. (Honest caveat if asked: WhatsApp only allows free-form
  messages within 24h of the person's last message; beyond that needs an
  approved template.)
- **Privacy, said plainly.** Data sits under the person's own sign-in. Gmail
  is read-only. Tokens are server-side; nobody, including Rhea, can open an
  inbox. Disconnect revokes at Google in the same click. Nothing trains anything.
- **Built for a bad-signal room.** Every answer autosaves to the server and
  mirrors to the phone; reload and you are back where you were.
- **Models.** Opus 5.5 at low effort for the agent itself (judgement, fast),
  Sonnet 5.5 for parsing interview answers. Server-side keys only.

## 5. The live demo flow (what Rhea does on screen)

1. Open heyrhai.com/chief-of-staff, sign in. Point at the data-safety note.
2. **About you**: name, WhatsApp number, speak a 30-second brief. Show the
   "copy a prompt for your Claude / ChatGPT" button — paste it into your own
   AI, it writes your brief from what it already knows about you.
3. **Design**: answer the first question by voice, deliberately rambling.
   Watch the chips at the top fill (one answer → several sections).
4. **Review**: show the compiled agent.md. Edit one rule by hand.
5. **Connect**: tap the WhatsApp button, say hi. (Optional: connect Google;
   mention the "unverified app" screen is expected.)
6. **Live**: on the phone, ask "what's on my calendar tomorrow" and "remind me
   at 6pm to call Amma". Show the reply. Then ask the same thing in the web
   console to show it is one memory.
7. Download the build kit (.md) — agent.md plus Claude Code instructions to
   run the same thing on your own number with your own dashboard.

Then everyone does the same. Set-up time.

## 6. Ways forward (the closing slides)

- **Out of the box**: Muse, Instinct, Dots — products in this space. The
  agent.md transfers; it is just a brief.
- **Build your own**: the exported .md has the architecture, tools, Google and
  WhatsApp setup, and a dashboard spec, as a single paste into Claude Code.
- **Keep this one**: everything changed in Review applies to the next message;
  what it learns in conversation lands in memory automatically.

## 7. Beyond the chief of staff (the idea to land)

A human chief of staff is valuable for two things an agent cannot be:
present in the room, and accountable. An agent is valuable for things a
human cannot be: awake at 3am, reading every email, never forgetting a
follow-up. So the role splits. Don't digitise the old job description —
ask which tasks want a tireless reader and which want a trusted person.
Then do the same for every role in the company: the outcome stays with the
person; the agents take the tasks.
