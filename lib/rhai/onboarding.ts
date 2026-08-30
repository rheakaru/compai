// The intern onboarding + orientation experience — content and types.
//
// This is the ONE file to edit. Fill in the intern's name, stipend, and dates
// in INTERN below; swap the call-exercise steps for the real Halol transcript
// when you're ready. Everything downstream (the /orient page, the offer/joining
// letters, the saved-progress doc) reads from here.
//
// Progress + voice takeaways persist to Firestore at rhaiOnboarding/{token} so
// Rhea and Yeshoda can see how engaged she's been — every reading has a voice
// takeaway (re-recordable, transcript shown), every exercise step captures her
// call, and the reveal shows what actually happened.

// An unguessable capability token — she uploads PII (Aadhaar/PAN/bank), so the
// URL itself is the credential. Rotate by changing this. The link is:
//   https://heyrhai.com/orient/welcome-6b24674647a47224
export const ONBOARDING_TOKEN = 'welcome-6b24674647a47224';

// --- The intern. Fill these three in; they flow into the page + the letters. ---
export interface InternConfig {
  name: string; // e.g. "Ananya Rao" — leave '' to greet generically
  title: string; // the title used on the offer/joining letters
  stipendLabel: string; // e.g. "₹25,000 per month" — '' renders a [BLANK] on the letter
  startDateLabel: string; // e.g. "1 September 2026"
  termLabel: string; // e.g. "a 6-month internship"
  pointPerson: string; // who she reports to while Rhea travels
}

export const INTERN: InternConfig = {
  name: '',
  title: 'Forward Deployed Anthropologist (Intern)',
  stipendLabel: '', // ← fill, or leave blank and the letter shows a fill-in line
  startDateLabel: '1 September 2026',
  termLabel: 'a 3-month internship',
  pointPerson: 'Yeshoda'
};

// ---------------------------------------------------------------------------
// Reading milestones — surface something to read/watch, then ask for her
// takeaway in her own voice. The `href` opens the live page; `body` is the
// short framing shown inline.
// ---------------------------------------------------------------------------
export interface ReadingItem {
  id: string;
  kicker: string;
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
  takeawayPrompt: string;
}

export const READINGS: ReadingItem[] = [
  {
    id: 'what-is-rhai',
    kicker: 'Read · 10 min',
    title: 'What Rhai is, and what we sell',
    body: 'Start on the homepage, then read the workshops page end to end — the three tiers, what a session actually involves, and the commercial terms. This is the offer you will be helping people say yes to.',
    href: 'https://heyrhai.com/workshops',
    hrefLabel: 'heyrhai.com/workshops',
    takeawayPrompt:
      'In your own words: what does Rhai actually sell, and who is it for? What surprised you?'
  },
  {
    id: 'case-dodla',
    kicker: 'Case study · 10 min',
    title: 'Dodla Dairy — the two-day leadership workshop',
    body: 'One of India\'s largest listed dairy companies. Two months of discovery, a 70-page demo intelligence dashboard, then two days rethinking the company with its leadership. Notice the reframe: the dashboard was the excuse, not the point.',
    href: 'https://heyrhai.com/writing/dodla-dairy',
    hrefLabel: 'Read the Dodla field notes',
    takeawayPrompt:
      'What is the difference between a report and an operator, in your own words? What would you have paid most attention to in that room?'
  },
  {
    id: 'case-hester',
    kicker: 'Case study · 10 min',
    title: 'Hester Biosciences — how to make twenty champions',
    body: 'A 40-year-old animal-health company that already had the will but a deployment problem. The move: give twenty people a page already drafted from their own words, and let them argue with it. Read how one champion becomes twenty.',
    href: 'https://heyrhai.com/writing/hester-biosciences',
    hrefLabel: 'Read the Hester write-up',
    takeawayPrompt:
      'Why does giving someone a draft of their own job beat asking them "what do you want?" How would you use that idea in your own outreach?'
  },
  {
    id: 'case-bliss',
    kicker: 'Case study · 5 min',
    title: 'Bliss Aerospace — the build day',
    body: 'Twenty thousand parts and no single screen to plan them on. Six hours inside their factory, then a build day with their planning team on a Microsoft tenant they already owned — they walked out with a working scheduler, someone who could extend it, and a punch-list. Zero new vendors. (No written case study yet — it is described on the homepage under "Recent engagements".)',
    href: 'https://heyrhai.com/#work',
    hrefLabel: 'See it on the homepage',
    takeawayPrompt:
      'Bliss got a working tool in an afternoon on systems they already owned. Why does "no new vendor, no lock-in" matter so much to a client? How would you say it to one?'
  },
  {
    id: 'the-community',
    kicker: 'Read · 5 min',
    title: 'Hang w AI — the community',
    body: 'The free weekly community is the top of our funnel and the trust engine. You will help run one this month. Read how a session works and the funnel logic behind why we do it for free.',
    href: 'https://heyrhai.com/hang-w-ai',
    hrefLabel: 'heyrhai.com/hang-w-ai',
    takeawayPrompt:
      'Why do you think we run a free community when we sell paid workshops? How would you help make one great?'
  },
  {
    id: 'how-we-pitch',
    kicker: 'Listen · 20 min',
    title: 'How we actually pitch',
    body: 'How Rhea runs a first call: listen first, name the one daily problem for each person, and let the client arrive at the idea themselves — she rarely "sells". You will work through a real call yourself in the next section; here, just note what good looks like.',
    takeawayPrompt:
      'What did you notice about how the call was run? Where did the client lean in, and why?'
  }
];

// ---------------------------------------------------------------------------
// The "what would you do?" exercise. Each step shows the conversation so far,
// asks her how she'd move it forward (captured by voice/text), then reveals
// what actually happened. Replace the sample below with the real Halol intro
// call — paste the transcript segments into `context` and the real next move
// into `whatHappened`. Keep it honest: this sample is a TEMPLATE, not the
// real Halol call.
// ---------------------------------------------------------------------------
export interface ExerciseStep {
  id: string;
  stage: string;
  context: string; // the conversation / situation so far
  question: string; // what we ask her
  whatHappened: string; // revealed after she answers
}

export interface Exercise {
  client: string;
  intro: string;
  isTemplate: boolean; // true = replace with the real transcript
  steps: ExerciseStep[];
}

export const EXERCISE: Exercise = {
  client: 'Halol (intro call)',
  isTemplate: true,
  intro:
    'A first call with a mid-sized manufacturer. The goal of an intro call is NOT to sell — it is to understand the company and find the one real problem worth building against. Read each step, record what you would do next, then see what actually happened.',
  steps: [
    {
      id: 's1',
      stage: 'The opening',
      context:
        'They came in warm — a referral. The founder opens with: "We know we should be doing something with AI, everyone keeps saying so, but honestly we don\'t know where to start. What do you do exactly?"',
      question:
        'It is minute two. How do you respond? Do you explain what Rhai does, or do something else first?',
      whatHappened:
        'Rhea did not pitch. She said "before I tell you what we do — tell me about a normal Monday morning for you. What is the first thing you open, and what is the most annoying part of it?" The founder talked for eight minutes. That is where the real problem lived.'
    },
    {
      id: 's2',
      stage: 'The real problem surfaces',
      context:
        'It turns out three plant heads each keep their own Excel, and nobody has a single view of what is actually in stock across plants. The founder half-jokes: "I find out we are short on something when a customer is already angry."',
      question:
        'What do you do with that? Do you propose a solution now, or keep pulling the thread?',
      whatHappened:
        'She reflected it back — "so you are flying blind between plants, and you learn about a gap from the customer, not before" — and then asked WHO owns each of those sheets and whether they trust each other\'s numbers. The trust question, not the tech, is what decides whether a dashboard gets used.'
    },
    {
      id: 's3',
      stage: 'The close of the call',
      context:
        'Forty minutes in. The founder is leaning forward, asking "so could you build something that shows all three plants in one place?" There is real energy.',
      question:
        'How do you end the call? What is the one next step you propose?',
      whatHappened:
        'She did not quote a price on the call. She proposed a short paid discovery — a day on-site to map how the three plants actually work — and said the workshop would be built against their real problem, not a generic demo. The concrete, low-risk next step is what converts energy into a booking.'
    }
  ]
};

// ---------------------------------------------------------------------------
// Tone training — the voice we want before she does any outbound.
// ---------------------------------------------------------------------------
export interface ToneRule {
  do: string;
  dont: string;
}

export const TONE_INTRO =
  'Everything you send on behalf of Rhai should sound like a sharp, warm operator who has actually run a business — never like a salesperson or a chatbot. We earn trust by being useful and specific, not by being impressive. Read these, then rewrite the practice message in our voice.';

export const TONE_RULES: ToneRule[] = [
  {
    do: 'Lead with their problem, in their words. "You mentioned finding out about stockouts from the customer — that is exactly the kind of thing we make visible."',
    dont: 'Lead with us. "Rhai is a leading AI consultancy that empowers businesses to leverage cutting-edge solutions."'
  },
  {
    do: 'Be concrete and short. One clear idea, one clear next step.',
    dont: 'Pile on adjectives and buzzwords (synergy, transformative, revolutionary, seamless).'
  },
  {
    do: 'Be honest about what we do not know yet, and curious. "I would want to sit with your finance lead for a day before I promise anything."',
    dont: 'Overpromise or quote outcomes we cannot back up.'
  },
  {
    do: 'Write like a person texting a smart friend — plain, no jargon, no exclamation spam.',
    dont: 'Write like a marketing email — no "Dear valued client", no "I hope this email finds you well".'
  }
];

export const TONE_PRACTICE =
  'A lead we met at Hang w AI runs a 40-person logistics company and said their dispatch team "lives in WhatsApp and a whiteboard". Draft a 3-line follow-up message inviting them to a workshop — in Rhai\'s voice. Record it, listen back, and re-record until it sounds like us.';

// ---------------------------------------------------------------------------
// Her focus areas — what the internship is actually about.
// ---------------------------------------------------------------------------
export const OUTCOME = 'Getting better at the human part of things.';

export const FOCUS_AREAS: { title: string; body: string }[] = [
  {
    title: 'Pipeline management',
    body: 'We sell to many people inside one organisation. After we land a client, help us sell to everyone else who needs to say yes — cultivating leads, keeping every thread warm, knowing who is next.'
  },
  {
    title: 'Client success & upsell',
    body: 'Work with clients after we hand over a solution. Is deployment actually happening? Where can we help? Where is the honest next thing to build for them?'
  },
  {
    title: 'Social media',
    body: 'Posting and capturing events. One day a week dedicated to each platform — schedule content, see what performed, keep the rhythm going.'
  },
  {
    title: 'Rhythm & communication',
    body: 'Monday check-ins to set the weekly plan. Proactive check-ins in between so communication stays open — do not wait to be asked.'
  },
  {
    title: 'Hang w AI community',
    body: 'Help run the community sessions — logistics, capturing the room, following up. We will do one this weekend or next.'
  }
];

// ---------------------------------------------------------------------------
// Logistics — the practical facts she needs.
// ---------------------------------------------------------------------------
export const LOGISTICS: { label: string; body: string }[] = [
  {
    label: 'Until 4 September',
    body: 'Come in person to the Judicial Layout office. The fastest way to understand what we do is to be in the room while we do it.'
  },
  {
    label: 'All of September',
    body: 'Rhea is travelling. Yeshoda is your point person — go to her for anything, early and often.'
  },
  {
    label: 'Every Monday',
    body: 'A check-in to set the week. Come with what you did last week and what you are planning.'
  }
];

// ---------------------------------------------------------------------------
// Project status — what we are pursuing right now. Keep this current.
// ---------------------------------------------------------------------------
export const PROJECT_STATUS: { title: string; body: string }[] = [
  {
    title: 'Workshops — three tiers now live',
    body: '₹1L three-hour intro, ₹3L customised full day, and a new ₹5L tier that adds a demo intelligence dashboard we build for the company beforehand.'
  },
  {
    title: 'Recent engagements',
    body: 'Dodla Dairy (two-day leadership workshop + demo dashboard) and Hester Biosciences ("twenty champions"). Both are written up on the site — read them.'
  },
  {
    title: 'The tooling behind us',
    body: 'A WhatsApp AI agent that captures tasks, schedules, drafts NDAs and invoices, and reads the calendar; the free brand-ontology marketing tool; the leads dashboard where the whole pipeline lives.'
  },
  {
    title: 'Community & top of funnel',
    body: 'Hang w AI (~350 members, Bangalore + Hyderabad) is the free weekly community and our trust engine — it feeds the paid workshops.'
  }
];

// ---------------------------------------------------------------------------
// The documents HR needs her to upload.
// ---------------------------------------------------------------------------
export const REQUIRED_DOCS: { id: string; label: string; note?: string }[] = [
  { id: 'aadhaar', label: 'Aadhaar Card' },
  { id: 'pan', label: 'PAN Card' },
  { id: 'bank', label: 'Bank account details', note: 'Passbook copy or a cancelled cheque' },
  { id: 'edu', label: 'Two highest educational qualification certificates' },
  {
    id: 'prev-employment',
    label: 'Previous employment documents',
    note: 'Offer / employment letter, relieving letter, or experience letter — if you have worked before'
  }
];

// The documents that must be on file before the offer/joining letters unlock.
// Prior-employment is optional ("if you have worked before"), so it's excluded.
export const MANDATORY_DOC_IDS = ['aadhaar', 'pan', 'bank', 'edu'];

// ---------------------------------------------------------------------------
// The milestone list that drives the progress rail. Order = the flow.
// ---------------------------------------------------------------------------
export const MILESTONES: { id: string; label: string }[] = [
  { id: 'welcome', label: 'Welcome & how this works' },
  ...READINGS.map(r => ({ id: `read-${r.id}`, label: r.title })),
  { id: 'exercise', label: 'What would you do? (a real call)' },
  { id: 'tone', label: 'Learn our voice' },
  { id: 'status', label: 'Where the company is right now' },
  { id: 'focus', label: 'Your focus areas & rhythm' },
  { id: 'docs', label: 'Upload your documents' },
  { id: 'letters', label: 'Your offer & joining letters' }
];
