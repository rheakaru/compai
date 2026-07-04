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
  }
];

export const SECTION_MODE: Record<string, ContextMode> = Object.fromEntries(
  DEFAULT_CONTEXT_SECTIONS.map(s => [s.id, s.mode])
);

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
    description: 'Standard single-page Indian invoice — no GST, Net 7, NEFT/IMPS details, TDS 194J note.',
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
