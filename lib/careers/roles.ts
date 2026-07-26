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
  }
];

export function roleBySlug(slug: string): OpenRole | undefined {
  return OPEN_ROLES.find(r => r.slug === slug);
}
