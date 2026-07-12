import Link from 'next/link';

// One-pager for prospective Rhai Interviews clients — how it works, what
// candidates experience, what the hiring team gets, rigor, pricing. Static,
// public, print-friendly (browser print → clean PDF to forward).

export const dynamic = 'force-static';

export const metadata = {
  title: 'How Rhai Interviews works — every applicant interviewed, ranked for fit',
  description:
    'Upload a JD, co-design a structured interview with Rhai, share one link. Every candidate gets a real first-round interview; you get transcripts scored and ranked. First job free.'
};

const STEPS: [string, string][] = [
  [
    'Tell Rhai about your company',
    'Sign in with Google, add your website, and describe the company in your own words — type or talk. Rhai reads your site, builds the brief its interviewer will use, and asks about anything important it’s missing.'
  ],
  [
    'Upload the job description',
    'Paste it or upload the PDF. Rhai designs a structured first-round interview from it — screening checks, experience, behavioral questions, role-specific scenarios, culture and motivation — each question tagged with what it probes.'
  ],
  [
    'Make the interview yours',
    'Edit, add, delete, and reorder every question. Chat with Rhai to refine — “add a question about handling difficult clients”, “keep it to 15 minutes”. Tell it the salary band once and it can answer candidates honestly.'
  ],
  [
    'Share one link',
    'Publish the role and every candidate interviews with Rhai at whatever hour suits them — no scheduling, no no-shows. Same questions, same standard, every time.'
  ],
  [
    'Review a ranked shortlist',
    'Each completed interview arrives summarised and scored for fit (0–100) with strengths and concerns, ranked. Filter by strong / possible / weak / incomplete / rejected, read any full transcript, and spend your human hours only on the top of the list.'
  ]
];

const RIGOR: [string, string][] = [
  ['Structured, not vibes', 'Every candidate gets the same core questions — the single best-evidenced way to make screening fair and predictive.'],
  ['Behavioral by design', 'Questions ask for real past behaviour and concrete examples, and Rhai follows up once when an answer is vague or rehearsed.'],
  ['Legally careful', 'Rhai never asks about age, religion, family status, health, or anything protected — and scores only job-relevant signals.'],
  ['Junk-proof', 'Contact details are validated (fake emails bounce at the door), one application per person, and off-topic or manipulative conversation gets politely shut down.'],
  ['Private by construction', 'The interviewer knows only your public company brief, the JD, and the question script. Your other data — and other companies’ — simply isn’t in the room.']
];

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-cream text-ink-900">
      <header className="border-b border-ink-200/60 print:hidden">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-baseline gap-2 text-ink-900">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
            <span className="font-display text-[17px] font-medium tracking-tight">Rhai</span>
            <span className="text-[13px] text-ink-400">Interviews</span>
          </Link>
          <Link href="/hire" className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-600">
            Start free →
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-14">
        {/* Hero */}
        <p className="eyebrow">Rhai Interviews · how it works</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl">
          Every applicant interviewed. Every interview structured. Ranked before you wake up.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-700">
          First-round screening is where hiring quietly breaks: too many applicants, twenty-minute calls that never
          happen, gut-feel decisions from skimmed CVs. Rhai runs a real, consistent first-round interview with every
          single applicant — and hands you a ranked shortlist with the evidence attached.
        </p>

        {/* Steps */}
        <section className="mt-12">
          <p className="eyebrow">Five steps, about twenty minutes to set up</p>
          <ol className="mt-4 space-y-6">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 font-display text-3xl text-accent">{i + 1}</span>
                <div>
                  <h2 className="font-display text-xl text-ink-900">{title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-700">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Candidate experience */}
        <section className="mt-12 rounded-xl border border-ink-200 bg-white p-6">
          <p className="eyebrow">What your candidates experience</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            A clean page with your company’s name, a short form, and a warm, professional conversation — about 15–20
            minutes, at midnight if that’s when they’re free. No portal logins, no scheduling ping-pong. Every
            candidate gets heard, which is more than most first rounds can promise — and it shows in how your brand
            comes across.
          </p>
        </section>

        {/* Rigor */}
        <section className="mt-12">
          <p className="eyebrow">The rigor under the hood</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {RIGOR.map(([t, d]) => (
              <div key={t} className="rounded-lg border border-ink-200 bg-white p-4">
                <p className="text-sm font-semibold text-ink-900">{t}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="mt-12">
          <p className="eyebrow">Pricing</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-ink-200 bg-white p-5">
              <p className="font-display text-2xl">Free</p>
              <p className="mt-1 text-sm text-ink-600">Your first job, up to 10 applications. No card needed.</p>
            </div>
            <div className="rounded-xl border border-ink-200 bg-white p-5">
              <p className="font-display text-2xl">
                ₹1,000 <span className="text-sm text-ink-400">/ job</span>
              </p>
              <p className="mt-1 text-sm text-ink-600">Each additional role you open.</p>
            </div>
            <div className="rounded-xl border border-ink-200 bg-white p-5">
              <p className="font-display text-2xl">₹3,000 – ₹5,000</p>
              <p className="mt-1 text-sm text-ink-600">Per job: up to 50 applications, or unlimited.</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-500">
            Compare: one round of human first-screens for 40 applicants ≈ 13 hours of someone’s week.
          </p>
        </section>

        {/* FAQ */}
        <section className="mt-12">
          <p className="eyebrow">Common questions</p>
          <dl className="mt-4 space-y-4">
            {(
              [
                ['Do I control the questions?', 'Completely. Rhai drafts; you edit, add, delete, and reorder every question, and iterate with Rhai in chat until it’s right. Nothing goes live until you publish.'],
                ['How is fit scored?', 'Against your JD and your questions only — skills, evidence, communication, ownership. You always see the full transcript next to the score; the AI ranks, you decide.'],
                ['What about candidates gaming the AI?', 'The interviewer is sandboxed: it knows only your brief, JD, and script, refuses instructions from candidates, and flags evasive or off-topic behaviour in its evaluation.'],
                ['Where does my data live?', 'Your company profile, JDs, and transcripts are yours, visible only to your account. Candidate details go only to you.'],
                ['Can it replace final rounds?', 'No — and it shouldn’t. Rhai gives every applicant a fair first round and gives you back the hours, so your team spends them on the people who matter.']
              ] as [string, string][]
            ).map(([q, a]) => (
              <div key={q}>
                <dt className="text-sm font-semibold text-ink-900">{q}</dt>
                <dd className="mt-1 text-[13px] leading-relaxed text-ink-600">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* CTA */}
        <section className="mt-14 rounded-xl bg-ink-900 p-8 text-center print:hidden">
          <p className="font-display text-2xl text-cream">Run your next role through Rhai.</p>
          <p className="mt-2 text-sm text-cream/70">Set up takes twenty minutes. Your first job is free.</p>
          <Link
            href="/hire"
            className="mt-5 inline-block rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-600"
          >
            Start free at heyrhai.com/hire →
          </Link>
        </section>

        <footer className="mt-10 flex items-center justify-between text-[11px] text-ink-400">
          <p>Rhai Interviews · a product by Rhai, Rhea Karuturi’s AI practice.</p>
          <p>heyrhai.com/hire</p>
        </footer>
      </article>
    </main>
  );
}
