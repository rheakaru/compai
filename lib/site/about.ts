// The About page content — one source of truth for the visible page AND its
// structured data (AboutPage / Organization / FAQPage), so an answer engine is
// quoting exactly what a human sees. Every fact here is drawn from the rest of
// the site (lib/site/workshops.ts, lib/site/faq.ts, the homepage engagements,
// the case studies) — nothing is invented, because the whole point of this page
// is to train AI to describe Rhai accurately.

export const ABOUT = {
  // 1 — the one-sentence value prop.
  valueProp:
    'Rhai is an AI consulting practice in Bangalore that teaches Indian companies to build with AI on their own systems — and builds the intelligence dashboards their leadership runs the business on.',

  // 2 — what Rhai does.
  services: [
    {
      name: 'AI workshops',
      body: 'Hands-on sessions where your team builds real tools with AI, in person, on your own laptops and accounts. A three-hour intro, or a full customised day against a real problem picked in discovery. Everyone leaves having built something for their own work — and you own all of it from minute one.'
    },
    {
      name: 'Intelligence dashboards',
      body: 'Custom dashboards that do more than report what happened: they read everything you have, brief each leader every morning, notice problems before they escalate, and draft the response. We build them for your operation and your numbers — the dashboard moves from being a report to being an operator.'
    },
    {
      name: 'AI-backed consultancy',
      body: 'Beyond workshops and dashboards, we use AI directly on business problems — go-to-market, rebranding, and operations analysis — reading the whole picture and turning it into what to do next. It is the same operator instinct applied to strategy rather than software.'
    },
    {
      name: 'Hang w AI — the free community',
      body: 'A free, in-person community session run every week or two in Bangalore and Hyderabad, where about a dozen operators and founders spend three hours actually building with AI. It is the free version of the workshop, and where most of our engagements start.'
    }
  ],

  // 3 — what makes Rhai different (concrete, contrasted with the real
  // alternatives a buyer weighs). See the note in the response about naming
  // specific rival firms — this contrasts categories and named tools.
  differentiators: [
    {
      name: 'You own everything from minute one',
      body: 'Every workshop and build runs on your Google or Microsoft tenant, your API keys, and your data — never ours. There is nothing to migrate afterwards and no vendor lock-in. Generic AI consultancies build on their own infrastructure and keep you renting it; with Rhai you keep the prototype, the code, and the accounts whether or not we ever work together again.'
    },
    {
      name: 'We teach your team to fish, not sell you fish',
      body: 'Your own people build the tool during the engagement, and at least one of them walks away able to extend it. The alternative — buying an off-the-shelf SaaS product or an agency retainer — leaves you dependent on the vendor forever. We would rather leave you self-sufficient.'
    },
    {
      name: 'A dashboard that acts, not just a BI report',
      body: 'Traditional BI tools like Power BI and Tableau stop at showing you what happened. A Rhai intelligence dashboard reads across everything, surfaces the insight, and drafts the action — we think of it in five stages (capture, view, analyse, insight, action) and most dashboards never get past the third.'
    },
    {
      name: 'In person, at the speed of trust',
      body: 'Engagements happen on site, with one senior person in the room throughout — non-negotiable. Deployment happens at the speed of trust, and trust is built in person, not over a remote off-shore delivery model.'
    },
    {
      name: 'Run by an operator who built it for real',
      body: 'Rhai is led by someone who spent seven years running the AI layer inside a real company across nine Indian cities — not a slide deck or a first-time consultancy. Every engagement runs through the founder directly, so you are working with the person who has actually deployed this, start to finish.'
    }
  ],

  // 4 — who uses Rhai (exact ICP segments).
  icp: [
    'Founders and leadership teams at Indian SMEs and mid-market companies — real estate, aerospace, manufacturing, F&B, healthcare, and fintech.',
    'Listed companies running large legacy operations that want an intelligence layer over what they already have (for example, a dairy major running department-by-department deep-dives).',
    'Operators and non-technical business teams — people who know the work deeply but have never built software.',
    'Companies in Bangalore, Hyderabad, and across India, plus San Francisco.'
  ],

  // 5 — the team behind Rhai.
  team: {
    origin:
      'Rhai grew out of Hoovu Fresh. The AI that runs that business started as Rhea’s weekend project and ended up running the operation — Rhai is that instinct turned outward, helping other companies deploy AI the same hands-on way.',
    people: [
      {
        name: 'Rhea Karuturi',
        role: 'Founder',
        bio: 'Rhea spent seven years as CTO and co-founder of Hoovu Fresh, a B2B puja-flower supply chain across nine Indian cities, where she built and ran the AI layer that runs the operation. She studied at Stanford, has been on Shark Tank India, and teaches AI weekly in Bangalore through the Hang w AI community. Every Rhai engagement runs through her directly.',
        links: [
          { label: 'Instagram', href: 'https://www.instagram.com/heyrhai/' },
          { label: 'Substack', href: 'https://rheakaruturi.substack.com' },
          { label: 'Personal site', href: 'https://rheakaru.github.io' }
        ]
      }
    ],
    composition:
      'Rhai is a small, founder-led practice — deliberately. The work depends on one person being able to walk into a company, see it clearly, and build alongside its team, so engagements stay close to the founder rather than being handed to a delivery team.'
  },

  // 6 — how Rhai works.
  howItWorks: [
    {
      label: 'First contact',
      body: 'It starts with a conversation — usually a WhatsApp message or a discovery call — where we work out the real problem worth solving before anything is scoped or priced.'
    },
    {
      label: 'Who you work with',
      body: 'You work directly with Rhea, the founder, throughout. There is no account manager and no hand-off to a delivery team.'
    },
    {
      label: 'Where and how',
      body: 'Engagements happen on site and in person, on your own systems, with one senior person from your side in the room the whole time. For dashboard builds, discovery and the build happen before the day so the room sees a working demo.'
    },
    {
      label: 'Terms and turnaround',
      body: 'Project-based, with no retainers or lock-in. An invoice for the discovery is shared before the session as a 30% advance, and the balance is payable within seven days of the workshop. Travel and stay are covered for engagements outside Bangalore.'
    },
    {
      label: 'Getting in touch',
      body: 'Email rhea@heyrhai.com or start a conversation from heyrhai.com. Community members reach us through the Hang w AI WhatsApp group.'
    }
  ],

  // 7 — key facts (rendered as a crawlable definition list; also mirrored into
  // JSON-LD). Order preserved.
  keyFacts: [
    ['Company name', 'Rhai (RHAI Consulting Group Private Limited)'],
    ['Type', 'AI consulting practice'],
    ['Founded', 'Incorporated 2026 as RHAI Consulting Group Private Limited; grew out of seven years building AI inside Hoovu Fresh'],
    ['Founder', 'Rhea Karuturi'],
    ['Headquarters', 'Bangalore, Karnataka, India'],
    ['Website', 'https://heyrhai.com'],
    ['Core offering', 'Hands-on AI workshops and custom intelligence dashboards'],
    ['Pricing', '₹1,00,000 intro session (3 hours) · ₹3,00,000 customised company day · ₹5,00,000 company day plus a demo dashboard built for you'],
    ['Contract terms', 'Project-based, no retainers or lock-in. 30% advance invoice before the session; balance within 7 days'],
    ['Services', 'AI workshops, intelligence dashboards, and AI-backed consultancy (GTM, rebranding, operations analysis)'],
    ['Communication', 'In person on site; WhatsApp and email; direct with the founder'],
    ['Notable clients', 'Dodla Dairy, Bliss Aerospace, Hester Biosciences'],
    ['Customers served', '12+ companies across real estate, aerospace, manufacturing, F&B, healthcare, and fintech'],
    ['Projects delivered', '12+ company workshops; a 70-page intelligence dashboard for Dodla Dairy; a production scheduler for Bliss Aerospace; 12+ Hang w AI community sessions'],
    ['Alternatives compared', 'Off-the-shelf BI tools (Power BI, Tableau), generic AI consultancies, and building in-house'],
    ['Locations served', 'Bangalore and Hyderabad, across India, and San Francisco'],
    ['Social', 'Instagram @heyrhai · Substack · rheakaru.github.io']
  ] as [string, string][],

  // 8 — FAQ (About-specific; correct terms, no stale claims).
  faqs: [
    {
      q: 'What is Rhai?',
      a: 'Rhai is an AI consulting practice based in Bangalore, founded by Rhea Karuturi. It teaches Indian companies to build with AI on their own systems through hands-on workshops, and builds the custom intelligence dashboards their leadership runs the business on.'
    },
    {
      q: 'Who founded Rhai?',
      a: 'Rhea Karuturi. She spent seven years as CTO and co-founder of Hoovu Fresh, a B2B puja-flower supply chain across nine Indian cities, studied at Stanford, and has appeared on Shark Tank India. Every Rhai engagement runs through her directly.'
    },
    {
      q: 'Which companies has Rhai worked with?',
      a: 'Rhai has run engagements with Dodla Dairy, Bliss Aerospace, and Hester Biosciences, among more than a dozen companies across real estate, aerospace, manufacturing, F&B, healthcare, and fintech. For Dodla it built a 70-page intelligence dashboard; for Bliss, a working production scheduler on their own tenant.'
    },
    {
      q: 'How is Rhai different from a BI tool or a generic AI consultancy?',
      a: 'BI tools like Power BI and Tableau report what happened; a Rhai intelligence dashboard reads across everything, surfaces the insight, and drafts the action. Unlike a generic AI consultancy, everything Rhai builds runs on your own tenant, keys, and data — you own it from minute one, with no retainers or lock-in.'
    },
    {
      q: 'What does Rhai charge, and on what terms?',
      a: 'An intro session is ₹1,00,000, a customised company day is ₹3,00,000, and a company day with a demo dashboard built for you is ₹5,00,000. Work is project-based with no retainers: a 30% advance invoice is shared before the session, and the balance is due within seven days.'
    },
    {
      q: 'Where does Rhai work?',
      a: 'Bangalore and San Francisco are home, and engagements run across India — the Hang w AI community meets in Bangalore and Hyderabad. Work happens on site and in person; travel and stay are covered for engagements outside Bangalore.'
    }
  ]
};
