// The public workshop offer — the three tiers, the commercial fine print, and
// the module library that every session is assembled from. Shared by
// /workshops and /workshops/modules so the pricing shown on the intro page and
// the pricing referenced from the library can never drift apart.

export type Tier = {
  id: string;
  name: string;
  price: string;
  /** Numeric rupee value — used for structured data (schema.org Offer). */
  priceInr: number;
  shape: string;
  blurb: string;
  includes: string[];
  featured?: boolean;
};

export const TIERS: Tier[] = [
  {
    id: 'intro',
    name: 'Intro session',
    price: '₹1,00,000',
    priceInr: 100000,
    shape: '3 hours · general',
    blurb:
      'A hands-on introduction to building with AI for your team — the fastest way to see what is actually possible. General, not yet customised to your company.',
    includes: [
      'Three hours, in person, on your team’s own laptops',
      'Assembled from the module library for the room you have',
      'Everyone builds something for their own work'
    ]
  },
  {
    id: 'company',
    name: 'Company session',
    price: '₹3,00,000',
    priceInr: 300000,
    shape: 'One day (6 hours) · customised',
    blurb:
      'A discovery call beforehand to pick the real problem, then a full day building against it — customised to your company, your workflows, your data.',
    includes: [
      'Discovery call before the day, and the session built from it',
      'Six hours on your machines, your accounts, your tenant',
      'Your workflows replace our examples throughout',
      'A prioritised list of what to build next'
    ]
  },
  {
    id: 'dashboard',
    name: 'Session + demo dashboard',
    price: '₹5,00,000',
    priceInr: 500000,
    shape: 'One day (6 hours) · customised · dashboard built for you',
    blurb:
      'Everything in the company session, plus a demo intelligence dashboard I build for your company beforehand — your operation, your numbers — so the room sees exactly what this would look like here.',
    includes: [
      'Everything in the company session',
      'A working demo dashboard built for your company before the day',
      'Walked through live, using your operation as the example',
      'Yours to keep, and the starting point if you take it further'
    ],
    featured: true
  }
];

export const FINE_PRINT: { label: string; body: string }[] = [
  {
    label: 'Travel',
    body: 'Bangalore and San Francisco are home. Anywhere else, travel and stay are covered by the company.'
  },
  {
    label: 'Payment',
    body: 'An invoice for the discovery is shared before the session as an advance — 30% is the standard. The balance is payable within 7 days of the workshop.'
  },
  {
    label: 'In the room',
    body: 'One senior person present throughout — non-negotiable. Deployment happens at the speed of trust, which is why this is in person.'
  },
  {
    label: 'What you own',
    body: 'Everything runs on your Google or Microsoft tenant, your API keys, your data. No retainers, no lock-in, nothing to migrate afterwards.'
  }
];

export type ModuleSection = {
  id: string;
  number: string;
  name: string;
  tagline: string;
  intro: string;
  modules: {
    title: string;
    headline: string;
    body: string;
    bestFor: string;
    duration: string;
  }[];
};

export const MODULE_SECTIONS: ModuleSection[] = [
  {
    id: 'foundations',
    number: '01',
    name: 'Foundations',
    tagline: 'Shared words. A working mental model.',
    intro:
      'No matter who is in the room, they need shared words and a working mental model before anything else lands.',
    modules: [
      {
        title: 'Open & intros',
        headline: 'Who’s actually in the room.',
        body: 'A structured round of introductions that surfaces what each person does, what they’d want AI to solve, and the one document their role depends on.',
        bestFor: 'Every session. It’s also the discovery call you didn’t have to schedule.',
        duration: '6–18 min'
      },
      {
        title: 'Vocabulary',
        headline: 'Ten words, and the room can talk.',
        body: 'Model, context, prompt, agent, API, connector, skill, context graph, harness — each defined in plain language with a mental model attached, so nothing later in the day sounds like jargon.',
        bestFor: 'Any room where people have used a chat window but never built anything.',
        duration: '25 min'
      },
      {
        title: 'How code changed',
        headline: 'From structure to reasoning.',
        body: 'Software used to be about describing the world’s structure in advance. Now you give a model enough scaffolding to find that structure itself — which is why the whole toolkit suddenly looks different.',
        bestFor: 'The bridge between vocabulary and everything after. Skip it and the rest floats.',
        duration: '5 min'
      },
      {
        title: 'Agent to employee',
        headline: 'You already know how to do this.',
        body: 'Building an agent is onboarding a smart new hire: reading, access, rules, and a month of corrections. The module climbs from prompt to agent to code, one rung at a time.',
        bestFor: 'Non-technical rooms and executives who already think in org charts.',
        duration: '18 min'
      }
    ]
  },
  {
    id: 'frames',
    number: '02',
    name: 'Frames',
    tagline: 'Why it matters. What it changes.',
    intro:
      'What AI actually changes about how a company works — and the objections that block the room until they’re answered.',
    modules: [
      {
        title: 'Companies in the AI age',
        headline: 'What a company actually is.',
        body: 'A two-thousand-year arc from span of control through Taylorism to now, landing on the line the whole day turns on: AI doesn’t augment a company, it reveals what it actually understands.',
        bestFor: 'Founders and leadership. The most-discussed module in the library.',
        duration: '35 min'
      },
      {
        title: 'Institutional knowledge',
        headline: 'What walks out the door.',
        body: 'The tacit expertise your best people carry is an asset you never booked, and it leaks three ways. This is the case for the dashboard as company memory — so senior judgment survives the person who held it.',
        bestFor: 'Family businesses and any room with a succession problem.',
        duration: '12 min'
      },
      {
        title: 'Moats & Thiel',
        headline: 'If everyone can build it, what’s left?',
        body: 'Software used to be the moat. When building gets cheap, the defensible things become distribution, taste, and genuinely going from zero to one — ending on the contrarian question worth holding through the build.',
        bestFor: 'Rooms worried AI erases their advantage. It reframes the fear as a question.',
        duration: '10 min'
      },
      {
        title: 'Privacy for enterprises',
        headline: 'But what happens to our data?',
        body: 'The objection that quietly blocks the room: what the encryption actually is, why API data doesn’t train the model, how the tiers differ — and why banning AI creates more risk than sanctioning it.',
        bestFor: 'Every corporate and regulated room. Answer it early or lose them.',
        duration: '12 min'
      }
    ]
  },
  {
    id: 'building',
    number: '03',
    name: 'Building',
    tagline: 'How the thing gets made.',
    intro:
      'The practical modules. Each one leaves people able to build or operate something specific, not just describe it.',
    modules: [
      {
        title: 'Dashboards',
        headline: 'From report to operator.',
        body: 'Five stages — input, view, analyze, insight, action — that turn a reporting screen into an intelligence layer: something that makes the company legible to its people and to AI, and then acts. Most dashboards stop at stage three.',
        bestFor: 'The spine of most corporate sessions. Where a dashboard stops describing and starts doing.',
        duration: '15 min'
      },
      {
        title: 'Building your agent',
        headline: 'An agent is five things.',
        body: 'Purpose, context, tools, boundaries, memory — one at a time, in build order, with read-only tools first as the discipline that keeps early agents safe.',
        bestFor: 'Immediately before a build session. It’s what makes the build productive instead of frantic.',
        duration: '20 min'
      },
      {
        title: 'Firebase setup',
        headline: 'Somewhere for it to live.',
        body: 'A six-step checklist for getting a real backend running, plus the prompt that hands the entire setup to Claude Code.',
        bestFor: 'Build days with people willing to install things. Skip for pure operator rooms.',
        duration: '10 min'
      },
      {
        title: 'Voice agents',
        headline: 'Typing in English is a class barrier.',
        body: 'Speech-to-text, reasoning, text-to-speech — three swappable pieces. The India case: vernacular voice isn’t a feature, it’s the front door for the next few hundred million users.',
        bestFor: 'Any room with field operations, or an India-market product.',
        duration: '15 min'
      },
      {
        title: 'Mastering Cowork',
        headline: 'Not a chat window. A colleague at your desk.',
        body: 'For people who’ll never open a terminal: pointing an agent at your actual files and folders, the four jobs worth delegating first, how to brief it, and where it still fails you.',
        bestFor: 'Operators and functional heads. The most-requested module of the year.',
        duration: '25 min'
      },
      {
        title: 'Skills — what to capture',
        headline: 'The knowledge only you have.',
        body: 'How to spot the expertise worth writing down, and how to capture it so an agent can reuse it rather than being re-taught every time. The third time you correct it the same way, that’s the skill.',
        bestFor: 'Rooms with deep institutional knowledge. Pairs with the succession frame.',
        duration: '15 min'
      }
    ]
  },
  {
    id: 'applied',
    number: '04',
    name: 'Applied',
    tagline: 'One function, taken apart.',
    intro:
      'Deep modules for a single business function, built from real engagements and adaptable to the room’s own industry.',
    modules: [
      {
        title: 'AI in marketing',
        headline: 'Slop is a thinking problem.',
        body: 'Content nobody wanted that anyone could have made — a systems failure, not an AI one. The fix is a brand ontology, built in seven steps, that any agent can then work from.',
        bestFor: 'Marketing teams and founder-led brands. A real-estate variant exists.',
        duration: '35–55 min'
      },
      {
        title: 'AI for accounting',
        headline: 'Where the hours actually go.',
        body: 'Built for Indian finance functions: Tally and Zoho workflows, GST reconciliation, and the capture-classify-reconcile work that quietly consumes a finance team’s month.',
        bestFor: 'Finance heads and CFOs, and any business where the books are the bottleneck.',
        duration: '20 min'
      },
      {
        title: 'Live demo',
        headline: 'A real one, running.',
        body: 'A walkthrough of a working intelligence dashboard — built for a real supply-chain business — so the room sees the finished shape before being asked to build toward it.',
        bestFor: 'Swappable for a walkthrough of the host company’s own systems.',
        duration: '10 min'
      },
      {
        title: 'AI executives',
        headline: 'An AI CEO, CFO, CMO.',
        body: 'What it looks like when each seat at the leadership table has an agent reading everything underneath it and surfacing the three things that matter today.',
        bestFor: 'Leadership rooms, immediately after the demo.',
        duration: '5 min'
      }
    ]
  },
  {
    id: 'mechanics',
    number: '05',
    name: 'Mechanics',
    tagline: 'What makes it a workshop.',
    intro:
      'The structural modules that make a session hands-on — and the closing that makes people leave changed rather than informed.',
    modules: [
      {
        title: 'Build session',
        headline: 'Now go build.',
        body: 'A framed, timed working block where people build something real for their own work — in pairs or alone, with help in the room. A hackathon, not a pitch.',
        bestFor: 'The centrepiece of any hands-on day. Protect this time; cut philosophy first.',
        duration: '30–90 min'
      },
      {
        title: 'Show & tell',
        headline: 'What did you actually make?',
        body: 'A four-question format for sharing what got built, which surfaces the good ideas and quietly teaches the room what was possible.',
        bestFor: 'Immediately after any build. It’s where the peer learning happens.',
        duration: '10–25 min'
      },
      {
        title: 'Next steps',
        headline: 'Four directions from here.',
        body: 'Connect a database, bring in outside data, add reasoning, deploy it — plus how to hand each of those to Claude Code without knowing how to write it.',
        bestFor: 'The last practical slide of a build day.',
        duration: '4 min'
      },
      {
        title: 'Why this matters',
        headline: 'The future is here. Let’s get our hands dirty.',
        body: 'The closing arc — on unevenly distributed futures, on why checklists beat brilliance, and on what it means to build rather than only consume this technology.',
        bestFor: 'The ending. It’s what makes a session land as a turning point, not a talk.',
        duration: '6–10 min'
      }
    ]
  }
];

export const SESSION_SHAPES: { shape: string; builtFrom: string }[] = [
  { shape: '60 min — talk', builtFrom: 'Vocabulary · Companies (lite) · Dashboards · Closing' },
  { shape: '90 min — leadership', builtFrom: 'Vocabulary · Companies · Privacy · Dashboards · Closing' },
  { shape: '3 hrs — intro', builtFrom: 'Foundations · Frames · Dashboards · Build · Show & tell · Closing' },
  { shape: '3 hrs — build day', builtFrom: 'Foundations · Dashboards · Agent · Firebase · 75-min build' },
  { shape: '3 hrs — operators', builtFrom: 'Foundations · Privacy · Cowork · Skills · Build · Closing' },
  { shape: '2 days', builtFrom: 'Day one, the full arc. Day two, the build.' }
];

export const MODULE_COUNT = MODULE_SECTIONS.reduce((n, s) => n + s.modules.length, 0);
