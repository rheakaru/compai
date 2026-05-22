import type { TourStep } from './Tour';

/**
 * The tour copy is the operator's screen-recording narrative, broken into
 * steps that anchor to specific DOM elements on the company page. Each
 * selector targets a stable wrapper that already exists in the page so
 * we don't need to thread refs through.
 */
export const PROFILE_TOUR_STEPS: TourStep[] = [
  {
    selector: '',
    title: 'Welcome to Throughline',
    body: (
      <>
        <p>
          Give us your website and a little background about your company (feel free to
          ramble). We give you a diagnostic that makes your business{' '}
          <em>legible for an AI transformation</em>.
        </p>
        <p className="mt-2">
          Throughline uses AI to abstract your business into its overall shape, defined by 9
          axes drawn from decades of business studies. That bird&apos;s-eye view sits outside
          the specifics of what you do — which is exactly what makes the right solutions
          obvious.
        </p>
      </>
    )
  },
  {
    selector: '[data-tour="one-liner"]',
    title: 'Your one-liner — the distilled shape',
    placement: 'bottom',
    body: (
      <>
        <p>
          One striking sentence about your business: not the category, the{' '}
          <em>structural truth</em>. Click <strong>read deeper</strong> to expand into a
          2–4 sentence synthesis that elaborates without the jargon.
        </p>
      </>
    )
  },
  {
    selector: '[data-tour="company-notes"]',
    title: 'Your context',
    placement: 'bottom',
    body: (
      <>
        <p>
          Anything the public web won&apos;t tell us — real customers, real numbers,
          internal SOPs, pricing. Save it, then click <strong>Re-run analysis</strong> and
          the agent reads your notes as context to sharpen the diagnosis.
        </p>
      </>
    )
  },
  {
    selector: '[data-tour="context-graph"]',
    title: 'The shape, in nouns',
    placement: 'top',
    body: (
      <>
        <p>
          People, orgs, locations, events, and objects that make up your world — and how
          they connect. We auto-populate from the web; you can add and link the rest. SKUs
          to customers, customers to locations, festivals to product lines.
        </p>
      </>
    )
  },
  {
    selector: '[data-tour="shape"]',
    title: '9 structural axes',
    placement: 'top',
    body: (
      <>
        <p>
          The 9 axes that decide what&apos;s hard for shapes like yours — make-to-order vs
          make-to-stock, how concentrated your customers are, how long cash is tied up,
          shelf life, and the rest. Together they describe the &ldquo;shape&rdquo; that
          drives everything below.
        </p>
        <p className="mt-2 text-ink-500">
          Click any card to see the evidence. Correct anything we got wrong.
        </p>
      </>
    )
  },
  {
    selector: '[data-tour="whats-hard"]',
    title: 'What&apos;s hard for you',
    placement: 'top',
    body: (
      <>
        <p>
          Jack Dorsey&apos;s idea of business as intelligence — understanding something
          hard and true that others don&apos;t. These are the load-bearing problems
          computed from your axes, so AI solutions target the right pain points.
        </p>
        <p className="mt-2 text-ink-500">
          Throughline doesn&apos;t guess what to automate — it shows you which class of
          problems you fall into so the answer is grounded.
        </p>
      </>
    )
  },
  {
    selector: '[data-tour="roles"]',
    title: 'Invite your team',
    placement: 'top',
    body: (
      <>
        <p>
          Invite up to three coworkers. Each gets a career-strategy document showing the
          translation vs judgement split in their role and what to double down on.
        </p>
        <p className="mt-2">
          You get the aggregate view — which roles are translation-heavy, what your
          operating-spine files are, where automation can land. Their individual answers
          stay theirs.
        </p>
      </>
    )
  },
  {
    selector: '[data-tour="export"]',
    title: 'Carry your context with you',
    placement: 'top',
    body: (
      <>
        <p>
          Export the whole diagnosis as a Markdown context document. Paste it into
          ChatGPT, Claude, or hand it to your dev. Every claim carries its provenance, so
          the consuming LLM won&apos;t promote hypotheses to facts.
        </p>
      </>
    )
  },
  {
    selector: '',
    title: 'Ready to go further?',
    body: (
      <>
        <p>
          Throughline gets you a precise read on what your business is, what&apos;s hard,
          and the class of solutions that fits. If you&apos;d like Rhea to suggest
          specific AI interventions or run a workshop with your team, book a session — the
          link sits at the bottom of the page.
        </p>
      </>
    )
  }
];
