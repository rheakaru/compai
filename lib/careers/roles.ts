// Open roles at Rhai. One source of truth for three surfaces: the public JD
// page at /careers/<slug>, the JobPosting structured data that gets it into
// Google Jobs and AI answer engines, and the link out to the Rhai-run first
// round at /interview/<interviewId>.
//
// The interview config for each role lives in lib/rhai/types.ts
// (DEFAULT_INTERVIEWS) — `interviewId` must match a config id there.

export interface OpenRole {
  slug: string;
  /** Must match an InterviewConfig id in DEFAULT_INTERVIEWS. */
  interviewId: string;
  title: string;
  /** One line under the title on the JD page + the meta description seed. */
  tagline: string;
  location: string;
  /** Bangalore, India — for JobPosting jobLocation. */
  city: string;
  region: string;
  employmentTypes: ('FULL_TIME' | 'CONTRACTOR')[];
  employmentLabel: string;
  /** Annual gross in INR. Shown plainly; also feeds baseSalary structured data. */
  salaryInr: number;
  salaryLabel: string;
  startLabel: string;
  travelRequired: boolean;
  /** ISO date the posting went live — required by JobPosting schema. */
  datePosted: string;
  /** Body of the JD, in markdown. Rendered on the page AND used for the
   *  `description` field in JobPosting structured data. */
  body: string;
}

export const OPEN_ROLES: OpenRole[] = [
  {
    slug: 'forward-deployed-anthropologist',
    interviewId: 'forward-deployed-anthropologist',
    title: 'Forward Deployed Anthropologist',
    tagline:
      'Join a client company for a week, learn how it really works, and earn the trust that makes deployment possible.',
    location: 'Bangalore, India · travel required',
    city: 'Bengaluru',
    region: 'Karnataka',
    employmentTypes: ['FULL_TIME', 'CONTRACTOR'],
    employmentLabel: 'Full-time or contract',
    salaryInr: 600000,
    salaryLabel: '₹6 LPA',
    startLabel: 'Rolling',
    travelRequired: true,
    datePosted: '2026-07-26',
    body: `Rhai is an AI consulting group. We believe the future is already here, it's just unevenly distributed (Gibson) — and we want to help deploy it to Indian companies to bring the future here.

We help companies deploy AI in three ways:

- Teaching AI workshops to align teams and orient them
- Building the tech they need
- Providing other consultancy and services — GTM, rebranding, ops analysis using AI to strengthen the process

We're not trying to reduce headcount — that's a narrow-minded way to think about the new paradigm AI makes possible.

Think about a sales executive. Her job is about an objective: to sell more. But her day is about tasks: answering emails, updating the CRM, chasing follow-ups, formatting the same sheet three different ways. **We build the tools that make jobs about outcomes again.**

We do this with AI in three places: to find patterns in a company's data, to help us build custom tools fast, and inside the product itself — so the dashboards we ship don't just make the company legible to people, they make it legible to AI. Dashboards going from reports to operators.

None of this works without trust.

> Deployment happens at the speed of trust.

That's why we're hiring anthropologists before engineers.

## The role

You will join a client company for a week or more, learn how it really works, and report back so we can build the right thing. Once we've built it, you stay for a while to help the company actually adopt it.

You are not an engineer. The founder (a former founder and CTO — this is not vibecoding) and her AI agent do the building. Your job is different: you have to see the company clearly, and you have to earn the trust that makes deployment possible. I believe it's easier to teach people how to communicate software than it is to teach them how to communicate with people.

## What you'll actually do

- **Spend time inside the org** — a week or more with a client. Sitting with the finance lead, riding along with ops, watching the sales team open the same messy sheet for the 400th time. Every company is unique in its internal culture, and situated in a broader history of how companies work: we look at both. This exercise is two-pronged — needfinding before we build solutions, and deployment of the solutions we actually build. The trust you build with the team is the most important metric for success through the whole process.
- **Study the company** — what they do, how they do it, what's on the website and brochure versus what's on the ground. Machinery, processes, teams, the metrics that matter.
- **Interview everyone** — every company comes down to its people. Talk to people not only to extract answers about the company, but because we want to actually hear and understand them. Equally important: making them feel heard and understood (not always the same thing).
- **Map the org** — both the formal structure that's in org charts and the informal structure. Whose desk do people visit when they're stuck, or before they approach the CEO? Who's skeptical, who's optimistic, who's insecure, who is unbothered. Who could be our internal champion, whose sign-off actually matters, who holds the data no one talks about.
- **Map the work** — which sheets get opened every morning, which workflows are tedious versus critical versus easy, what feels intuitive to them and what doesn't.
- **Send a daily field report to the founder** — what you saw, who you met, what surprised you, what you don't yet understand. A hypothesis of what the company culture and structure is, followed by daily, real analysis of the data we receive.
- **Come back after the build** — to train people, sit with the reluctant ones, and translate between the software and the humans. This is the human element that's critical, and where trust gets cashed in.

## You'll probably be great at this if you

- Studied English, history, anthropology, sociology, philosophy, design, or education — and are proud of it
- Have taught, or want to teach — teachers are excellent at this work
- Read a lot and think in stories and systems
- Can walk into a room of strangers and leave with three of them wanting to tell you more
- Notice what people don't say
- Are comfortable being the least experienced person in the room without being intimidated by it — seeing that as an opportunity instead
- Can write clearly and quickly, every day, without polishing forever

## You're probably not the right fit if you

- Want to become a software engineer (we'll point you to better places for that)
- Need a fixed script or a clear rubric to feel useful
- Get impatient with people who are slow to trust new tools

## Logistics

- Based in Bangalore; must be willing to travel and stay in a client city for the duration of an engagement
- Compensation: ₹6 LPA
- Full-time or contract
- Start: rolling

## To apply

The first round is a conversation with Rhai, our own AI interviewer — about fifteen minutes, by voice or text, whenever suits you. If that goes well, the second round is with Rhea.`
  },
  {
    slug: 'forward-deployed-engineer',
    interviewId: 'forward-deployed-engineer',
    title: 'Forward Deployed Engineer',
    tagline:
      'Embed in a company, model how its systems really work, and build the tools it needs — with an AI agent as your pair.',
    location: 'Bangalore, India · travel required',
    city: 'Bengaluru',
    region: 'Karnataka',
    employmentTypes: ['FULL_TIME', 'CONTRACTOR'],
    employmentLabel: 'Full-time or contract',
    salaryInr: 600000,
    salaryLabel: '₹6 LPA',
    startLabel: 'Rolling',
    travelRequired: true,
    datePosted: '2026-07-27',
    body: `Rhai is an AI consulting group. We believe the future is already here, it's just unevenly distributed (Gibson) — and we want to help deploy it to Indian companies to bring the future here.

We help companies deploy AI in three ways:

- Teaching AI workshops to align teams and orient them
- Building the tech they need
- Providing other consultancy and services — GTM, rebranding, ops analysis using AI to strengthen the process

We're not trying to reduce headcount — that's a narrow-minded way to think about the new paradigm AI makes possible.

Think about a sales executive. Her job is about an objective: to sell more. But her day is about tasks: answering emails, updating the CRM, chasing follow-ups, formatting the same sheet three different ways. **We build the tools that make jobs about outcomes again.**

We do this with AI in three places: to find patterns in a company's data, to help us build custom tools fast, and inside the product itself — so the dashboards we ship don't just make the company legible to people, they make it legible to AI. Dashboards going from reports to operators.

None of this works without trust.

> Deployment happens at the speed of trust.

For this role that's true twice over — you'll be inside a company's real systems and data.

## The role

You'll embed in a client company, learn how its systems actually work, and build the tools it needs — on the company's own stack, with the Rhai agent as your pair. You are an engineer, but not the kind who hand-writes every line. The agent writes most of the code. Your job is to bring the systems thinking, the abstraction sense, and the taste that decides what to build and what "good" looks like — and the judgment to touch production systems safely.

We're not looking for ten years in one framework. We're looking for someone who can stare at a tangle of spreadsheets and half-broken processes and see the clean data model underneath — who thinks in interfaces, invariants, and layers, knows when to abstract and when not to, and can move from a messy business problem to a working tool fast.

## What you'll actually do

- **Embed in a client** — a week or more, onsite. Learn their systems, their data, their stack, and the way work actually flows versus how the org chart says it does.
- **Model the domain** — turn the mess of sheets, processes, and edge cases into a clean data model and a sane architecture. This is the part that decides whether everything downstream is simple or a nightmare.
- **Build the tools** — dashboards, integrations, automations — with the Rhai agent, on the client's own Google or Microsoft tenant, their APIs, their data. You direct the agent, review and correct its output, and own the structure. Nothing to migrate afterwards; they keep everything.
- **Integrate safely** — auth, data integrity, failure modes, reversibility. You're touching things that matter, so you think about blast radius before you ship.
- **Make it stick** — sit with the people who'll actually use it, fix what's awkward, and hand over something that gets adopted rather than admired once and forgotten.
- **Report back to the founder** as you go — what the systems really look like, what you're building, what's fighting you, and what you don't yet understand.

## You'll probably be great at this if you

- Think in systems and abstractions — you can model a messy domain cleanly, and explain why you modelled it that way
- Have shipped real software end to end — any stack, scrappy is fine; you've felt what breaks in production
- Are AI-native about building — you already build with AI agents, and you have the taste to know when the output is right and when it's quietly wrong
- Know when *not* to abstract — you've been burned by the wrong abstraction and learned from it
- Care about other people's data and systems the way you'd want someone to care about yours
- Can explain a technical idea to a non-technical person without condescending
- Are comfortable being embedded in a room of strangers and earning their trust

## You're probably not the right fit if you

- Want a heads-down IC role writing every line yourself, away from users — this is the opposite
- Think AI-assisted building is beneath "real" engineering
- Over-engineer by default, or can't operate without a precise spec
- Get careless around production data, or impatient with people slow to trust new tools

## Logistics

- Based in Bangalore; must be willing to travel and stay in a client city for the duration of an engagement
- Compensation: ₹6 LPA
- Full-time or contract
- Start: rolling

## To apply

The first round is a conversation with Rhai — the AI agent you'd actually build alongside. About fifteen minutes, by voice or text, whenever suits you. If it goes well, the second round is with Rhea.`
  }
];

export function roleBySlug(slug: string): OpenRole | undefined {
  return OPEN_ROLES.find(r => r.slug === slug);
}
