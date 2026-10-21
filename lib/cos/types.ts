// Chief of Staff builder — shared types. Isomorphic (no server imports) so the
// builder UI and the API routes agree on one shape.
//
// One document per signed-in person: cosAgents/{uid}. Everything the person
// tells us lands here, autosaved as they go, so a dropped connection on
// mobile never loses an answer. Google refresh tokens live separately in
// cosSecrets/{uid} (server-only; never returned to the browser).

export type CosSectionKey = 'role' | 'knows' | 'cadence' | 'tools' | 'voice' | 'rules';

export interface CosSectionDef {
  key: CosSectionKey;
  label: string;
  /** The question the interviewer asks to fill this section. */
  question: string;
  /** What "filled" means — shown as a hint in the checklist. */
  hint: string;
}

/** The six touchpoints from the workshop — asked in this order. */
export const COS_SECTIONS: CosSectionDef[] = [
  {
    key: 'role',
    label: 'Role & objective',
    question:
      "First — what do you actually want this chief of staff to do for you? Think of the one outcome you'd hold a great human chief of staff to. What should be true in a month because they exist?",
    hint: 'What they own, what success looks like'
  },
  {
    key: 'knows',
    label: 'What they already know',
    question:
      'What should they know about you before day one — your work, the people around you, your week, your current priorities? Say as much or as little as you like; you can also paste a brief later.',
    hint: 'Your world, priorities, the people that matter'
  },
  {
    key: 'cadence',
    label: 'When they reach out',
    question:
      'When can they reach out to you, and why? A morning brief? Only when something needs a decision? Are there hours they should never message you?',
    hint: 'Proactive check-ins, quiet hours, what justifies a ping'
  },
  {
    key: 'tools',
    label: 'Tools',
    question:
      'What should they be able to touch? Your calendar (read, or also create events), your email (read), reminders. Anything they should never touch?',
    hint: 'Calendar, email, reminders — and what is off limits'
  },
  {
    key: 'voice',
    label: 'How they speak',
    question:
      'How should they talk to you? Short and blunt, warm, formal? Any language mix? Should they ask before acting or just do it?',
    hint: 'Tone, length, language, formality'
  },
  {
    key: 'rules',
    label: 'Other rules',
    question:
      "Last one — any hard rules? Things they must always do, never do, or always check with you first? Give them a name too if you'd like.",
    hint: 'Always / never, escalation, a name'
  }
];

export interface CosSpec {
  /** What they call the agent. Defaults to "Chief of Staff". */
  agentName: string;
  role: string;
  objective: string;
  knows: string;
  cadence: string;
  /** Free text — what the person said about tools. */
  tools: string;
  toolFlags: {
    calendarRead: boolean;
    calendarWrite: boolean;
    gmailRead: boolean;
    reminders: boolean;
  };
  voice: string;
  rules: string;
}

export interface CosProfile {
  name: string;
  /** WhatsApp number as typed. */
  phone: string;
  /** Digits only, with country code (10-digit Indian numbers get 91). */
  phoneDigits: string;
  bio: string;
  links: string[];
}

export interface CosMessage {
  role: 'agent' | 'user';
  text: string;
  at: number;
  audioUrl?: string;
}

export interface CosGoogleConnection {
  email: string;
  scopes: string[];
  connectedAt: number;
}

export interface CosAgent {
  uid: string;
  email: string;
  profile: CosProfile;
  spec: CosSpec;
  /** Guided interview transcript (the "design" step). */
  interview: CosMessage[];
  interviewDone: boolean;
  /** Compiled operating document — the agent's system prompt body. */
  agentMd: string;
  /** Set when the person edits the compiled doc by hand; wins over spec. */
  agentMdEdited: boolean;
  /** Short facts the agent chose to remember from conversations. */
  memory: string[];
  status: 'draft' | 'live';
  google?: CosGoogleConnection;
  step: number;
  createdAt: number;
  updatedAt: number;
}

export const EMPTY_SPEC: CosSpec = {
  agentName: '',
  role: '',
  objective: '',
  knows: '',
  cadence: '',
  tools: '',
  toolFlags: { calendarRead: true, calendarWrite: true, gmailRead: true, reminders: true },
  voice: '',
  rules: ''
};

export const EMPTY_PROFILE: CosProfile = { name: '', phone: '', phoneDigits: '', bio: '', links: [] };

export function newAgent(uid: string, email: string, name = ''): CosAgent {
  const now = Date.now();
  return {
    uid,
    email,
    profile: { ...EMPTY_PROFILE, name },
    spec: { ...EMPTY_SPEC, toolFlags: { ...EMPTY_SPEC.toolFlags } },
    interview: [],
    interviewDone: false,
    agentMd: '',
    agentMdEdited: false,
    memory: [],
    status: 'draft',
    step: 0,
    createdAt: now,
    updatedAt: now
  };
}

/** Which sections have an answer yet. Drives the checklist + the interviewer. */
export function sectionFilled(spec: CosSpec, key: CosSectionKey): boolean {
  switch (key) {
    case 'role':
      return !!(spec.role.trim() || spec.objective.trim());
    default:
      return !!spec[key].trim();
  }
}

export function allSectionsFilled(spec: CosSpec): boolean {
  return COS_SECTIONS.every(s => sectionFilled(spec, s.key));
}

/** Digits only; a bare 10-digit number is assumed Indian (+91). */
export function toPhoneDigits(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith('0')) return `91${d.slice(1)}`;
  return d;
}

/** The copy-paste prompt that pulls a person's context out of their own Claude/ChatGPT. */
export const SELF_BRIEF_PROMPT = `I'm setting up an AI chief of staff and it needs a brief about me. Using everything you know about me from our past conversations, write a 200–300 word brief in the third person covering: who I am and what I do, what I'm working on right now and what matters most, the people and companies I deal with most, how my typical week runs, how I like to work and communicate, and anything a great chief of staff should know on day one. Plain prose, no headings, nothing invented — if you don't know something, leave it out.`;
