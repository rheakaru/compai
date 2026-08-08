// Rhai — the AI cofounder layer. These types back the four surfaces where
// Rhea and Rhai meet: the context vault, the idea scratchpad, the proactive
// "Today" suggestions, and the skills registry. Everything is operator-only
// and persisted in Firestore, mutated exclusively through /api/rhai/*.

// ---------------------------------------------------------------------------
// Context vault — durable context about Rhea, her networks, her thinking.
// Freeform markdown sections; Rhai bakes all of them into its system prompt.
// ---------------------------------------------------------------------------

/**
 * Two memory tiers (the AIMemory pattern applied to Rhai itself):
 * - `core`: small, identity-critical prose Rhea writes by hand. Loaded into
 *   EVERY prompt in full.
 * - `library`: big reference documents. Only their auto-generated digest card
 *   is always loaded; the full body is fetched on demand via the
 *   `read_context` tool when a task actually needs it.
 */
export type ContextMode = 'core' | 'library';

export interface ContextSection {
  id: string;
  title: string;
  /** Freeform markdown Rhea pastes/edits (or uploads via rhai:context). */
  body: string;
  /** ~100-word always-loaded summary card. Library sections only. */
  digest?: string;
  updatedAt: number;
}

export interface ContextSectionDef {
  id: string;
  title: string;
  body: string;
  mode: ContextMode;
  /** One-line hint baked into the index card: when should Rhai reach for this? */
  whenToUse: string;
}

/** Seeded on first load so the vault opens with the right prompts to fill. */
export const DEFAULT_CONTEXT_SECTIONS: ContextSectionDef[] = [
  {
    id: 'about',
    title: 'About me',
    body: '',
    mode: 'core',
    whenToUse: 'Always relevant — who Rhea is.'
  },
  {
    id: 'networks',
    title: 'Networks & orgs I can tap',
    body: '',
    mode: 'core',
    whenToUse: 'Always relevant — the org channels for paid sessions.'
  },
  {
    id: 'thinking',
    title: 'My thinking on AI & dashboards',
    body: '',
    mode: 'core',
    whenToUse: 'Always relevant — the philosophy behind every proposal.'
  },
  {
    id: 'templates',
    title: 'Email & comms templates / rules',
    body: '',
    mode: 'core',
    whenToUse: 'Always relevant — rules every draft must respect.'
  },
  {
    id: 'demos',
    title: 'Hoovu demo library (AI features + build specs)',
    body: '',
    mode: 'library',
    whenToUse:
      'Read when preparing a demo, pitch, proposal, or client build spec — maps client type → which Hoovu features to show, with pitch lines and Claude Code build specs.'
  },
  {
    id: 'community',
    title: 'Hang w AI community directory',
    body: '',
    mode: 'library',
    whenToUse:
      'Read when suggesting follow-ups, network plays, session invites, or researching whether someone is already in the community (~80 people: leads, hosts, amplifiers).'
  },
  {
    id: 'teaching',
    title: 'How I teach — modules, decks & style',
    body: '',
    mode: 'library',
    whenToUse:
      'Read when planning a session, building a deck, or prepping workshop materials — module library, session arcs, signature lines, deck design system.'
  },
  {
    id: 'projects',
    title: 'Project library (hobby builds & reusable patterns)',
    body: '',
    mode: 'library',
    whenToUse:
      'Read when spec’ing a client build or brainstorming a solution — 11 shipped projects (Vanaja vernacular voice, Cahoots structured AI actions, Chapel second-brain, Vendetta, ComPrice…) with a pattern→project index. We may have built it before.'
  },
  {
    id: 'genai-divide',
    title: 'MIT — The GenAI Divide (State of AI in Business 2025)',
    body: '',
    mode: 'library',
    whenToUse:
      'Read when framing WHY companies fail at AI or making the strategic case for Rhai — proposals, pitches, decks, objection handling, positioning. MIT NANDA evidence: ~95% of enterprise GenAI gets zero ROI; the divide is about APPROACH (learning + workflow-fit + trust), not model quality; external partnerships beat internal builds ~2:1; back-office is where the real ROI hides; deployment happens at the speed of trust.'
  }
];

export const SECTION_MODE: Record<string, ContextMode> = Object.fromEntries(
  DEFAULT_CONTEXT_SECTIONS.map(s => [s.id, s.mode])
);

// ---------------------------------------------------------------------------
// People intelligence — every person in Rhea's orbit becomes a living profile
// Rhai can research, cite, and grow. Seeded from the Hang w AI directory;
// enriched by web research, chat mentions, and Rhea's own notes.
// ---------------------------------------------------------------------------

export type PersonTier = 'lead' | 'partner' | 'collaborator' | 'community';

export const PERSON_TIER_LABELS: Record<PersonTier, string> = {
  lead: '🔥 Lead',
  partner: '🤝 Partner',
  collaborator: '🛠 Collaborator',
  community: 'Community'
};

export type PersonStatus =
  | 'stub' // name + scraps only
  | 'needs-info' // Rhai tried researching, needs Rhea (full name / LinkedIn)
  | 'researched'; // has a web-researched profile

export interface PersonLogEntry {
  at: number;
  text: string;
  source: 'rhea' | 'rhai' | 'chat' | 'seed';
}

/** A relationship edge — how this person connects to someone else in the orbit. */
export interface PersonConnection {
  /** The other person's name (may or may not have their own profile yet). */
  name: string;
  /** e.g. "introduced us", "mutual", "same YPO forum", "college friend". */
  relationship: string;
  note?: string;
}

export interface RhaiPerson {
  id: string;
  name: string;
  tier: PersonTier;
  /** One-line who-they-are (role @ company). */
  headline?: string;
  company?: string;
  city?: string;
  phone?: string;
  links?: string[];
  /** Who introduced Rhea to this person (the referral edge). */
  introducedBy?: string;
  /** Relationship map — mutuals, shared committees, referrers. */
  connections?: PersonConnection[];
  /** Rhai's web-researched profile (markdown). */
  summary?: string;
  /** Rhea's own running context — the editable field. */
  notes?: string;
  /** Append-only intel log — who added what, when. */
  notesLog?: PersonLogEntry[];
  /** What Rhai needs from Rhea to research further. */
  questions?: string[];
  status: PersonStatus;
  /** Linked pipeline lead, if this person is one. */
  leadId?: string;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Persistent chat with Rhai — the standing conversation. Never disappears.
// ---------------------------------------------------------------------------

export interface RhaiChatMessage {
  id: string;
  role: 'user' | 'rhai';
  text: string;
  /** Transparency notes for tool actions taken ("Updated profile: X"). */
  toolNotes?: string[];
  at: number;
}

// ---------------------------------------------------------------------------
// Quick to-dos — fast capture, one place. Resolution links them to a lead.
// ---------------------------------------------------------------------------

export interface RhaiTodo {
  id: string;
  text: string;
  /** Resolved link (by name match against leads/people). */
  leadId?: string;
  leadLabel?: string;
  /** Multiple possible matches — Rhea picks one in the UI. */
  candidates?: { leadId: string; label: string }[];
  done: boolean;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Task board — work assigned to Rhai. Tasks run with the client's full
// context (understanding + note sessions) plus the relevant library docs,
// in parallel, and report results back to the board.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Rhai as interviewer — a reusable hiring framework. Each InterviewConfig is
// one open role; candidates talk to Rhai on a public, sandboxed page
// (/interview/<id>) that knows ONLY the role brief — no vault, no pipeline,
// no tools. Sessions + fit summaries land in the operator's Interviews tab.
// ---------------------------------------------------------------------------

export interface InterviewConfig {
  /** Slug — the public URL is /interview/<id>. */
  id: string;
  title: string;
  active: boolean;
  /** Shown to the candidate on the landing card (markdown-ish plain text). */
  publicIntro: string;
  /** Everything Rhai MAY share/ask about the role. The sandbox boundary. */
  roleBrief: string;
  /** Internal rubric — what Rhea actually wants. Never revealed verbatim. */
  criteria: string;
  /** Hard requirements Rhai must explicitly verify (geography, availability…). */
  hardChecks: string[];
  /**
   * Neutral areas to explore in the personality/fit phase — safe to guide
   * questions without revealing the scoring rubric. Rhai asks behavioural
   * questions across these AFTER the logistics phase.
   */
  fitAreas: string[];
  /** Rhai's first message (static — no API call to start a session). */
  openingMessage: string;
  /** Candidate turns before Rhai must wrap up. */
  maxTurns: number;
  /**
   * Operator's scheduling / booking link (e.g. a Google Calendar appointment
   * page). Pasted once per role; reused to invite shortlisted candidates.
   */
  schedulingLink?: string;
  createdAt: number;
}

export interface InterviewMessage {
  role: 'rhai' | 'candidate';
  text: string;
  at: number;
  /** Public Storage URL of the raw voice recording, if this candidate reply
   * came from the mic. Preserved so Rhea can hear the actual voice from the
   * transcript, not just the transcribed text. */
  audioUrl?: string;
}

export interface InterviewCandidate {
  name: string;
  email: string;
  phone: string;
  /** CV/resume file (PDF/DOC/DOCX) in Storage — now mandatory at capture. */
  resumeUrl?: string;
  /** Original CV filename, for display. */
  resumeName?: string;
  /** How the candidate found the role (Apply Type dropdown). */
  applyType?: string;
  /** Which agency, when applyType is "Agency". */
  agencyName?: string;
}

/** Apply Type dropdown — how the candidate reached the role. */
export const APPLY_TYPE_OPTIONS = [
  'Agency',
  'LinkedIn',
  'Naukri',
  'Indeed',
  'Foundit (Monster)',
  'Apna Jobs',
  'Shine',
  'Hirist',
  'Company Career Page',
  'Employee Referral',
  'Walk-in',
  'Social Media',
  'Campus Hiring',
  'Other'
] as const;

/** Seed agencies for the Agency-Name dropdown. Extend as new agencies sign on
 *  (a managed admin list is a fast-follow; "Other" covers the gap for now). */
export const DEFAULT_AGENCIES = ['Placemate', 'Human Capital'] as const;

export interface InterviewSummary {
  verdict: 'strong_fit' | 'possible' | 'not_a_fit';
  summary: string;
  strengths: string[];
  concerns: string[];
  /** Explicit hard-check results — geography/availability/start date. */
  hardCheckNotes: string;
}

export interface InterviewSession {
  id: string;
  interviewId: string;
  candidate: InterviewCandidate;
  messages: InterviewMessage[];
  status: 'in_progress' | 'completed';
  /**
   * Operator hiring stage — undefined means "just applied" (the default
   * inbox). Rhea shortlists promising candidates, then marks them invited
   * once she's sent them a scheduling link.
   */
  stage?: 'shortlisted' | 'invited';
  /** Candidate's closing questions — relayed to Rhea, not answered by Rhai. */
  questionsForRhea?: string;
  summary?: InterviewSummary;
  createdAt: number;
  completedAt?: number;
}

/** Seeded roles. This instance: the workshop intern. */
export const DEFAULT_INTERVIEWS: InterviewConfig[] = [
  {
    id: 'workshop-intern',
    title: 'Workshop Intern — AI consulting practice',
    active: true,
    publicIntro:
      'Hi! This is a short conversational interview (10–15 minutes) with Rhai — the AI cofounder that helps run Rhea Karuturi’s AI workshop practice. Rhai will ask about you, your availability, and what you’re hoping to learn.\n\nYou can type your answers or speak them — we ENCOURAGE voice: it helps us get a feel for how you communicate, which matters in this role. Take your time; there are no trick questions.',
    roleBrief: [
      'ROLE: Workshop Intern for Rhea Karuturi’s AI consulting practice (Bangalore).',
      'STIPEND: ₹15,000/month.',
      'FORMAT: Remote day-to-day, but IN PERSON at every Bangalore event — that part is non-negotiable. Outstation events do NOT require travel; Bangalore only.',
      'WORKLOAD SHAPE: the practice talks to ~10 clients a week; workshop sessions are full days (~6 hours) and there can be up to 5 in a week. The intern attends the Bangalore ones.',
      'THE WORK: (1) tech support at sessions — helping attendees install the Claude desktop app, set up GitHub, set up Firebase (all teachable, Rhea will train them; they need to be digitally native and good at patiently helping people); (2) capturing the sessions — photos/video on a phone and editing a short reel afterwards (doesn’t need to be a social-media person; basic capture + editing comfort is enough).',
      'TIMING: start right away. Ideal commitment is 3 months; 1 month is acceptable.',
      'LEARNING PITCH: this is NOT calendar-scheduling/note-taking admin work — the practice runs on an AI agent (Rhai) that does that. The intern sits inside real workshops at interesting companies, learns how they run, works alongside a production AI agent, and gets what amounts to a mini-MBA in AI consulting.',
      'HIRING MANAGER: Rhea Karuturi (7 years CTO of Hoovu Fresh, Stanford; runs the Hang w AI community and paid AI workshops).'
    ].join('\n'),
    criteria: [
      'Rhea wants: young, smart, CLEAR and to-the-point communication (but warm, never rude); genuine earnestness and enthusiasm to learn; disciplined, hard-working, follows through without being chased — she does not want to manage or follow up on anyone.',
      'Strong negative signal: hustle-culture hot air — over-excited, buzzwordy, all talk. Prefer understated and earnest over performative energy.',
      'Digitally native; comfortable learning Claude/GitHub/Firebase setup quickly; comfortable being on their feet helping people at events; comfortable filming on a phone and doing basic editing.',
      'Communication quality in THIS interview is itself a signal (that is why voice is encouraged). Note whether answers are concise and considered vs rambling or canned.',
      'US-studying background is a nice-to-have, NOT required.'
    ].join('\n'),
    hardChecks: [
      'Geography: are they in Bangalore (or reliably in Bangalore) for in-person events? People apply without checking this — verify explicitly.',
      'Availability: can they actually be present for full-day (6h) sessions, up to 5 days in a busy week? What are their other commitments (college schedule etc.)?',
      'Start date: can they start right away?',
      'Duration: 3 months ideal — can they commit? (1 month minimum is acceptable; note what they say.)'
    ],
    fitAreas: [
      'Follow-through & discipline — a time they committed to something hard and saw it through without anyone chasing them; how they organise themselves.',
      'How they handle people & pressure — a moment they helped someone frustrated or stuck, or kept calm when things went sideways at an event/job.',
      'Genuine curiosity & self-direction — something they taught themselves recently, purely because they wanted to; what pulls them about AI specifically.',
      'Earnestness vs hype — probe whether their enthusiasm is grounded (real examples, honest about what they don’t know) or performative (buzzwords, big claims).',
      'Judgement & communication — can they be clear and concise under a slightly open-ended question, and do they ask good questions back.'
    ],
    openingMessage:
      "Hi, I'm Rhai — I work with Rhea on her AI workshop practice, and I'll be doing this first conversation with you. It's relaxed, about 10–15 minutes.\n\nHere's how I'll run it: first I'll get a few quick logistics out of the way (where you're based, your availability), then we'll spend most of the time on the more interesting part — who you are and how you work.\n\nAnswer by voice or text, whatever's comfortable (voice is great — it helps us get a feel for how you communicate, and don't worry about small transcription typos, I follow the meaning fine).\n\nTo start: tell me a bit about yourself — where you're based, and what you're studying or working on right now?",
    maxTurns: 18,
    createdAt: 0
  },
  {
    id: 'forward-deployed-anthropologist',
    title: 'Forward Deployed Anthropologist — Rhai',
    active: true,
    publicIntro:
      'This is the first round for the Forward Deployed Anthropologist role — a conversational interview (about 15 minutes) with Rhai, the AI agent that helps run Rhai. If it goes well, the second round is with Rhea herself.\n\nWe read people for a living, so how you talk matters more here than a polished CV. You can type or speak your answers — we ENCOURAGE voice. Take your time; there are no trick questions, and there is no rubric you can game.',
    roleBrief: [
      'ROLE: Forward Deployed Anthropologist at Rhai — an AI consulting group helping Indian companies deploy AI.',
      'WHAT RHAI DOES: (1) teaches AI workshops to align and orient teams; (2) builds the tech companies need; (3) provides other consultancy — GTM, rebranding, ops analysis using AI to strengthen the process.',
      'THE PREMISE: we are NOT trying to reduce headcount — that is a narrow-minded way to think about what AI makes possible. Think of a sales executive: her job is about an objective (sell more) but her day is about tasks (answering emails, updating the CRM, chasing follow-ups, formatting the same sheet three ways). We build the tools that make jobs about outcomes again.',
      'WHY AN ANTHROPOLOGIST: deployment happens at the speed of trust. That is why we hire anthropologists before engineers.',
      'THE ROLE: you join a client company for a week or more, learn how it really works, and report back so we can build the right thing. Once we have built it, you stay a while to help the company actually adopt it. You are NOT an engineer — the founder (a former founder and CTO; this is not vibecoding) and her AI agent do the building. Your job is to see the company clearly and earn the trust that makes deployment possible.',
      'WHAT YOU ACTUALLY DO: spend a week or more inside the org (sitting with the finance lead, riding along with ops, watching the sales team open the same messy sheet for the 400th time) — needfinding before we build, and deployment after. Study the company: what the website and brochure say versus what is true on the ground; machinery, processes, teams, the metrics that matter. Interview everyone — to understand them, and to make them feel heard. Map the org: the formal chart AND the informal one (whose desk do people visit when stuck, who is skeptical, who could be our internal champion, whose sign-off actually matters, who holds the data no one talks about). Map the work: which sheets get opened every morning, which workflows are tedious vs critical vs easy. Send a daily field report to the founder — what you saw, who you met, what surprised you, what you do not yet understand. Come back after the build to train people, sit with the reluctant ones, and translate between the software and the humans.',
      'GOOD FIT: studied English, history, anthropology, sociology, philosophy, design or education — and is proud of it; has taught or wants to teach; reads a lot and thinks in stories and systems; can walk into a room of strangers and leave with three of them wanting to tell you more; notices what people do not say; comfortable being the least experienced person in the room and sees that as an opportunity; can write clearly and quickly, every day, without polishing forever.',
      'NOT A FIT: wants to become a software engineer (we will point them somewhere better); needs a fixed script or clear rubric to feel useful; gets impatient with people who are slow to trust new tools.',
      'LOGISTICS: based in Bangalore; must be willing to travel and stay in a client city for the duration of an engagement. Full-time or contract. Compensation ₹6 LPA. Start is rolling.',
      'PROCESS: first round is this conversation with Rhai; second round is with Rhea Karuturi (former founder and CTO of Hoovu Fresh, Stanford; runs the Hang w AI community and Rhai’s paid AI workshops).'
    ].join('\n'),
    criteria: [
      'This role is a read on a PERSON, not a CV. The core question: can they see an organisation clearly, and can they earn trust fast enough that deployment actually happens?',
      'Strong positives: a humanities or social-science education they are genuinely proud of (English, history, anthropology, sociology, philosophy, design, education); teaching experience of any kind — teachers are excellent at this work; visible reading habit; thinks in stories AND systems; concrete evidence they get strangers to open up; notices the unsaid — subtext, hierarchy, who is uncomfortable; writes clearly and fast without over-polishing.',
      'Strong negatives: wants this as a stepping stone into software engineering; needs a fixed script, rubric, or clear instructions to feel useful; impatient or contemptuous towards people slow to trust new tools; treats "the business" as an abstraction rather than a room full of specific people; performative intellectualism — name-dropping theory without a real observation attached.',
      'Watch for whether their stories about people are OBSERVED (specific, textured, someone else is the subject) or SELF-CENTRED (every anecdote is about how well they did). This role is about seeing others.',
      'Comfort with ambiguity and being the least experienced person in the room is essential — probe for it without telegraphing that it is what we want.',
      'They must be genuinely fine that they are not the builder. Some candidates will hear "AI consulting" and want the engineering seat; that is a mismatch, not a flaw.',
      'Communication quality in THIS interview is itself the primary work sample — this is a job about talking to people and writing daily field reports. Note whether they are clear, specific, and warm, versus rambling, canned, or abstract. Voice is encouraged for exactly this reason.'
    ].join('\n'),
    hardChecks: [
      'Geography: are they in Bangalore (or reliably relocating to Bangalore)? This is the home base — verify explicitly.',
      'Travel: engagements mean travelling to a client city and STAYING there for a week or more at a time. Are they genuinely able and willing to do that, and is there anything (family, study, visa) that constrains it?',
      'Not an engineering role: do they understand they will not be building the software, and is that genuinely what they want? Ask directly and listen for hesitation.',
      'Compensation: the role pays ₹6 LPA. Confirm that works for them — do not be coy about it.',
      'Start date and shape: start is rolling, full-time or contract. When could they start, and which arrangement are they looking for?'
    ],
    fitAreas: [
      'Seeing an organisation clearly — a time they understood how a group, workplace, family or institution REALLY worked, in a way that differed from its official story. What tipped them off?',
      'Earning trust with strangers, fast — a time someone told them something they probably should not have, or opened up unexpectedly. What did they do to make that possible?',
      'Noticing the unsaid — ask about a room, meeting or conversation where the real dynamic was different from the stated one. Probe for specificity; vague "I read the room well" answers should be pushed on once.',
      'Writing under a daily cadence — do they write regularly, and can they ship something clear without polishing it forever? Ask what they have written recently and how long it took.',
      'Teaching and patience — a time they helped someone reluctant, slow, or skeptical learn something. Listen for warmth versus condescension; contempt for the slow learner is disqualifying.',
      'Being the least experienced in the room — a time they were out of their depth around experts. Are they curious and unbothered, or defensive and performative?',
      'What they read and think about — genuine intellectual life, in their own words. Grounded and specific beats broad and impressive.'
    ],
    openingMessage:
      "Hi, I'm Rhai — the AI agent that helps run Rhai, the practice you're applying to. I'll be doing this first conversation with you; if it goes well, the next one is with Rhea herself. This takes about fifteen minutes and it's meant to be relaxed.\n\nHere's the shape: I'll get a few logistics out of the way first (where you're based, travel, the practical stuff), and then we'll spend most of the time on the part that actually matters for this role — how you see people and organisations.\n\nAnswer by voice or text, whichever is comfortable. Voice is genuinely better here: this is a job about talking to people, so how you talk is part of what we're listening for. Don't worry about transcription typos, I follow the meaning fine.\n\nTo start: tell me about yourself — where you're based, what you studied, and what you're doing right now?",
    maxTurns: 20,
    createdAt: 0
  },
  {
    id: 'forward-deployed-engineer',
    title: 'Forward Deployed Engineer — Rhai',
    active: true,
    publicIntro:
      'This is the first round for the Forward Deployed Engineer role — a conversational interview (about 15 minutes) with Rhai, the AI agent you would build alongside. If it goes well, the second round is with Rhea herself.\n\nWe care far more about how you think — in systems, abstractions, and tradeoffs — than about your CV or which frameworks you know. You can type or speak your answers; we ENCOURAGE voice. Take your time; there are no trick questions.',
    roleBrief: [
      'ROLE: Forward Deployed Engineer at Rhai — an AI consulting group helping Indian companies deploy AI.',
      'WHAT RHAI DOES: (1) teaches AI workshops to align and orient teams; (2) builds the tech companies need; (3) provides other consultancy — GTM, rebranding, ops analysis using AI to strengthen the process.',
      'THE PREMISE: we are NOT trying to reduce headcount — that is a narrow-minded way to think about what AI makes possible. A sales executive’s job is about an objective (sell more) but her day is about tasks (email, CRM, chasing follow-ups, formatting the same sheet three ways). We build the tools that make jobs about outcomes again.',
      'HOW WE BUILD: with AI in three places — to find patterns in a company’s data, to build custom tools fast, and inside the product itself, so the dashboards we ship make the company legible to people AND to AI (dashboards going from reports to operators).',
      'WHY THIS ROLE: the building is done WITH an AI agent (Rhai), alongside the founder (a former founder and CTO). You are an engineer — but not the kind who hand-writes every line. The agent writes most of the code. Your value is the systems thinking, the abstraction sense, and the taste that decides WHAT to build and what "good" looks like — plus the judgment to touch a company’s real systems and data safely.',
      'WHAT YOU ACTUALLY DO: embed in a client company (onsite, a week or more), learn how its systems, data, and stack really work. Model the domain — turn a tangle of spreadsheets, processes, and edge cases into a clean data model and a sane architecture. Build the tools they need (dashboards, integrations, automations) with the Rhai agent, on the client’s own Google/Microsoft tenant, their APIs, their data — you direct the agent, review and correct its output, and own the structure. Integrate safely: auth, data integrity, failure modes, reversibility. Then make it stick — sit with the people who will use it, fix what is awkward, and hand over something they actually adopt. Report to the founder as you go.',
      'WHAT WE LOOK FOR: not ten years in one framework. Someone who can look at a mess and see the clean data model underneath; who thinks in interfaces, invariants, and layers; who knows when to abstract and when not to; who has shipped real software end to end (any stack, scrappy is fine); who is AI-native about building and has the taste to catch when the agent is quietly wrong; and who is careful with other people’s systems.',
      'NOT A FIT: wants a heads-down IC role writing every line away from users; thinks AI-assisted building is beneath "real" engineering; over-engineers by default or needs a precise spec to function; careless with production data; impatient with people slow to trust new tools.',
      'TRUST: deployment happens at the speed of trust — and it matters twice over here, because you are inside a company’s real systems and data. Trust and judgment about their stack are as central as the code.',
      'LOGISTICS: based in Bangalore; must be willing to travel and stay in a client city for the duration of an engagement. Full-time or contract. Compensation ₹6 LPA (₹6,00,000/year). Start is rolling.',
      'PROCESS: first round is this conversation with Rhai; second round is with Rhea Karuturi (former founder and CTO of Hoovu Fresh, Stanford; runs the Hang w AI community and Rhai’s paid AI workshops).'
    ].join('\n'),
    criteria: [
      'The core question: can they think clearly in systems and abstractions, do they have the taste to direct an AI agent to build the RIGHT thing well, and do they have the judgment to touch a client’s real systems and data safely?',
      'Strong positives: decomposes a messy real-world domain into a clean data model; thinks in interfaces, invariants, and layers; knows when to abstract AND when not to (over-abstraction is itself a negative); has actually shipped working software end to end, even scrappy; comfortable directing AI to build and reviewing/correcting its output rather than needing to write every line; reasons soundly about auth, data integrity, APIs, and failure modes; can explain a technical idea simply to a non-technical person.',
      'Strong negatives: cargo-cult / resume-driven answers with no WHY behind choices; either cannot abstract at all OR over-engineers everything; dismissive of AI-assisted building ("real engineers write it themselves") — a genuine mismatch for this role; careless about other people’s data and systems; needs a precise spec and cannot operate in the ambiguity of a messy live org.',
      'Systems thinking is the PRIMARY signal — probe how they would model a real messy scenario and listen for clean decomposition, awareness of tradeoffs, and knowing the limits of their own model. A tidy model with no awareness of where it breaks is weaker than a rougher model that knows its edges.',
      'Taste while building with AI: they should be genuinely energised by building fast with an agent, and have real judgment about when its output is right versus quietly wrong — not threatened by it, not blindly trusting it. Ask for a time AI got it wrong and they caught it.',
      'Trust and care with client systems: they will have access to real production data and tenants. Look for humility, care, and good instincts about safety, blast radius, and reversibility.',
      'Communication is itself a work sample — they will explain the tools they build to non-technical client teams. Note whether they explain systems clearly and concisely, or hide behind jargon.'
    ].join('\n'),
    hardChecks: [
      'Geography: are they in Bangalore (or reliably relocating to Bangalore)? Verify explicitly.',
      'Travel: engagements mean going onsite to a client city and STAYING there for a week or more. Are they genuinely able and willing, and is there anything (family, study, visa) that constrains it?',
      'Has shipped something real: have they actually built AND shipped working software end to end — any stack, scrappy is fine, not just coursework? Ask for one concrete example and what broke.',
      'Builds WITH an AI agent, on client systems: do they understand the agent writes most of the code and that they will be touching a company’s real production data — and is that genuinely what they want, not a pure heads-down coding role? Ask directly.',
      'Compensation: the role pays ₹6 LPA. Confirm that works for them — do not be coy about it.',
      'Start date and shape: start is rolling, full-time or contract. When could they start, and which arrangement are they looking for?'
    ],
    fitAreas: [
      'Systems modelling — give them a messy real-world domain (e.g. a company’s orders, inventory, and cash across a few cities) and ask how they would model it into a clean data model. Probe decomposition, tradeoffs, and where their model would break.',
      'Abstraction judgment — a time they chose to abstract something, or deliberately chose NOT to. Do they understand the cost of the wrong abstraction, from real experience?',
      'Shipping under ambiguity — a real thing they built end to end from an unclear spec. What they cut, what they got wrong, and how they recovered.',
      'Building with AI — how they use AI tools to build today. Do they direct and review with taste, or accept output blindly? A concrete time the AI was wrong and they caught it.',
      'Trust and care with systems — a time they touched production or real data. How did they think about safety, blast radius, and reversibility?',
      'Explaining to non-experts — can they make a technical idea land for a non-technical person without condescending? They will do this daily with client teams.'
    ],
    openingMessage:
      "Hi, I'm Rhai — the AI agent that helps run Rhai, and the one you'd actually build alongside if this works out. I'll be doing this first conversation; if it goes well, the next one is with Rhea herself. It takes about fifteen minutes and it's meant to be relaxed.\n\nHere's the shape: I'll get a few logistics out of the way first (where you're based, travel, the practical stuff), and then we'll spend most of the time on the part that actually matters — how you think about systems, how you build, and how you work with AI to do it.\n\nAnswer by voice or text, whichever is comfortable. Don't worry about transcription typos, I follow the meaning fine.\n\nTo start: tell me a bit about yourself — where you're based, what you've built recently, and what you're working on right now?",
    maxTurns: 20,
    createdAt: 0
  }
];

export type RhaiTaskStatus = 'queued' | 'running' | 'done' | 'failed';

export interface RhaiTask {
  id: string;
  title: string;
  /** What to do, in Rhea's words (or generated from a scan action). */
  detail: string;
  /** Client this task is for — its context rides along. */
  leadId?: string;
  leadLabel?: string;
  /** Skill from the registry that should shape the output, if any. */
  skillId?: string;
  /** Research tasks append their result as a lead note session. */
  appendToNotes?: boolean;
  status: RhaiTaskStatus;
  /** The output: research findings, draft text, prep notes… */
  result?: string;
  /** Iterating chat on the task detail page — Rhea ↔ Rhai edits of the result. */
  chat?: { role: 'rhea' | 'rhai'; text: string; at: number }[];
  /** Set when the output was saved as a generated client document. */
  documentId?: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

// ---------------------------------------------------------------------------
// Idea scratchpad — parked thoughts Rhai enriches, researches, and resurfaces.
// ---------------------------------------------------------------------------

export type IdeaStatus =
  | 'parked' // just written down
  | 'researching' // Rhai is enriching it
  | 'brainstormed' // Rhai has added research/brainstorm; awaiting Rhea
  | 'promoted' // became a real lead / project
  | 'dropped';

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  parked: 'Parked',
  researching: 'Researching…',
  brainstormed: 'Brainstormed',
  promoted: 'Promoted to lead',
  dropped: 'Dropped'
};

export interface RhaiIdea {
  id: string;
  /** The raw thought, e.g. "should ask aishwarya if we can do this with her school". */
  text: string;
  status: IdeaStatus;
  /** Set on promotion — the lead this idea became (or attached to). */
  leadId?: string;
  leadLabel?: string;
  /** Rhai's research + brainstorm output (markdown). */
  enrichment?: string;
  /** Questions Rhai needs answered before it can go further. */
  questions?: string[];
  /** Rhea's answers / added context, appended over time. */
  extraContext?: string;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Proactive suggestions — the "Today" panel. Rhai reads pipeline + notes +
// ideas + context and proposes concrete next actions. Draft-only: approving
// queues an intent for the Claude Code "hands"; nothing outward is automatic.
// ---------------------------------------------------------------------------

export type SuggestionKind =
  | 'follow_up' // chase a lead / payment
  | 'draft' // draft an email / proposal / invoice
  | 'research' // research a company / person
  | 'prep' // prepare deck / demo / session notes
  | 'network' // tap a network or org
  | 'invoice'; // billing action

export const SUGGESTION_KIND_LABELS: Record<SuggestionKind, string> = {
  follow_up: 'Follow up',
  draft: 'Draft',
  research: 'Research',
  prep: 'Prep',
  network: 'Network',
  invoice: 'Invoice'
};

export type SuggestionStatus = 'proposed' | 'approved' | 'dismissed' | 'done';

export interface RhaiSuggestion {
  id: string;
  kind: SuggestionKind;
  title: string;
  /** Why Rhai suggests this + exactly what it will do if approved. */
  detail: string;
  /** Linked lead, when the suggestion is about one. */
  leadId?: string;
  leadLabel?: string;
  status: SuggestionStatus;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Skills registry — the bridge to Rhea's Claude Code / Claude chat skills.
// Each entry names a skill, what it's for, and the default model to run it
// with. Execution happens through the Claude Code hands (intent queue);
// the registry is how Rhai knows what it can reach for.
// ---------------------------------------------------------------------------

export interface RhaiSkill {
  id: string;
  name: string;
  description: string;
  /** Default model for this skill's task, e.g. 'claude-opus-4-8'. */
  model: string;
  /** Which funnel stage(s) it serves — free text, e.g. "proposal", "closing". */
  stage?: string;
  enabled: boolean;
}

export const MODEL_OPTIONS = [
  { id: 'claude-fable-5', label: 'Fable 5 (deepest — demo builds)' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8 (builds & research)' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5 (solid default)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (fast & cheap)' }
] as const;

/** Seeded from the skills Rhea already has in Claude Code / Claude chat. */
export const DEFAULT_SKILLS: RhaiSkill[] = [
  {
    id: 'workshop-modules',
    name: 'Workshop modules (deck assembly)',
    description: 'Assemble session decks from the reusable teaching modules — vocabulary primer, Dorsey, moats, dashboards 5-stages, Hoovu demo, voice agents…',
    model: 'claude-sonnet-5',
    stage: 'prep',
    enabled: true
  },
  {
    id: 'presentation-styling',
    name: 'Presentation styling',
    description: 'Render decks in the editorial black-and-white house style (Fraunces/Inter Tight, 16:9 HTML slides).',
    model: 'claude-sonnet-5',
    stage: 'prep',
    enabled: true
  },
  {
    id: 'workshop-proposals',
    name: 'Proposals & scoping docs',
    description: 'The formal scope doc after discovery calls — engagement structure, dashboard philosophy, pricing, follow-on project.',
    model: 'claude-sonnet-5',
    stage: 'proposal',
    enabled: true
  },
  {
    id: 'workshop-emails',
    name: 'Workshop emails',
    description: 'Pre-session intro email (terms + logistics), closing email with materials, payment follow-ups.',
    model: 'claude-haiku-4-5-20251001',
    stage: 'comms',
    enabled: true
  },
  {
    id: 'freelance-invoices',
    name: 'Invoices',
    description:
      'GST tax invoice under RHAI CONSULTING GROUP PRIVATE LIMITED — single page, Net 7, company bank details, CGST/SGST or IGST from the client GSTIN state. (Replaced the freelancer TDS-194J format, Aug 2026.)',
    model: 'claude-haiku-4-5-20251001',
    stage: 'billing',
    enabled: true
  },
  {
    id: 'company-research',
    name: 'Company / person research',
    description: 'Deep research run on a company or contact before discovery / recce — web search, synthesis, angle-finding.',
    model: 'claude-opus-4-8',
    stage: 'research',
    enabled: true
  },
  {
    id: 'demo-build',
    name: 'Demo dashboard build',
    description: 'Kick off building the client demo dashboard/project from requirements in smart notes.',
    model: 'claude-fable-5',
    stage: 'build',
    enabled: true
  },
  {
    id: 'blog-writeup',
    name: 'Blog post / case study',
    description: 'Post-engagement write-up about the company and projects for the personal site + social.',
    model: 'claude-sonnet-5',
    stage: 'closing',
    enabled: true
  }
];
