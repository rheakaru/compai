// Homepage FAQ — one source of truth for the visible section AND the FAQPage
// structured data. Answer engines (and Google's rich results) only trust
// schema that matches what a human actually sees on the page, so these must
// stay in sync — hence one array, rendered twice.
//
// Written to be quotable: each answer opens with a direct, self-contained
// sentence that makes sense lifted out of context, because that's exactly what
// an assistant will do with it.

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  {
    q: 'What does Rhai do?',
    a: 'Rhai is an AI consulting practice based in Bangalore that helps Indian companies actually deploy AI. We do three things: run hands-on AI workshops that teach your team to build on your own systems, build custom intelligence dashboards that leadership runs the business on, and provide AI-backed consultancy across GTM, rebranding, and operations analysis.'
  },
  {
    q: 'How much does an AI workshop cost?',
    a: 'An intro session is ₹1,00,000 for three hours — a general, hands-on introduction to building with AI for your team. A company session is ₹3,00,000 for a full day (six hours), customised to your business after a discovery call, and your team leaves with a working prototype for a real problem. Payment is same-day, with no retainers.'
  },
  {
    q: 'What is an intelligence dashboard, and how is it different from BI?',
    a: 'A traditional BI dashboard reports what happened. An intelligence dashboard reads everything you have, briefs every leader each morning, notices problems before they escalate, and drafts the response. We think of it in five stages — capture, view, analyse, insight, action — and most dashboards stop at stage three. The goal is a dashboard that moves from being a report to being an operator.'
  },
  {
    q: 'Does our team need to be technical to do a Rhai workshop?',
    a: 'No. The workshops are built for operators, founders, and business teams rather than engineers — people who know the work but have never built software. We do require one senior person present throughout, which is non-negotiable, because the prototype needs someone with the authority to say what actually matters.'
  },
  {
    q: 'Who owns what Rhai builds?',
    a: 'You do, from minute one. Workshops run on your Google or Microsoft tenant, your API keys, and your data, so there is nothing to migrate afterwards and no vendor lock-in. You keep the prototype, the code, and the accounts whether or not we ever work together again.'
  },
  {
    q: 'Where does Rhai work?',
    a: 'Bangalore and San Francisco for now, with travel billed at cost. Engagements happen on site — we come to your office, sit with your teams, and build alongside them, because deployment happens at the speed of trust and trust is built in person.'
  },
  {
    q: 'Is there a free way to try working with Rhai?',
    a: 'Yes, two. Hang w AI is a free in-person community session run every week or two in Bangalore and Hyderabad, where about a dozen people spend three hours actually building something with AI. You can also build a brand ontology for your company free in about fifteen minutes and keep the JSON file, whether or not we ever work together.'
  },
  {
    q: 'Who is behind Rhai?',
    a: 'Rhai is Rhea Karuturi’s practice. She spent seven years as CTO and co-founder of Hoovu Fresh, a B2B puja-flower supply chain across nine Indian cities, where the AI that runs the operation started as her weekend project. She studied at Stanford, has been on Shark Tank India, and teaches AI weekly in Bangalore through the Hang w AI community. Every engagement runs through her directly.'
  }
];
