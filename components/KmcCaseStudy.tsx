// The KMC Constructions workshop — "Building an infrastructure of trust" — in
// its own design language (lavender ground, deep purple, Bricolage Grotesque
// display), matching the standalone HTML write-up rather than the site's
// editorial-prose template. Same pattern as HesterCaseStudy / DodlaCaseStudy.
//
// Every selector is scoped under `.kmc`: the source styled `body`, `header`,
// `nav`, `h1`, `footer` etc. globally, and SiteHeader renders a <header>, so
// unscoped rules would leak into the shared chrome. The source's own nav and
// footer are dropped in favour of SiteHeader/SiteFooter.
//
// Fonts are vendored in public/fonts (next/font would make the build fetch
// from Google). Bricolage Grotesque is a variable font — one file per subset
// covers both 500 and 700. Photos were base64 in the source; they now live in
// public/img/writing/kmc-constructions/.

import Link from 'next/link';
import { SiteFooter, SiteHeader } from './SiteChrome';

const LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

const face = (family: string, weight: string, file: string, range: string) => `
@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url(/fonts/${file}) format('woff2');
  unicode-range: ${range};
}`;

const FONT_FACES = [
  face('Bricolage Grotesque', '500 700', 'bricolage-grotesque-normal-500_700-latin-ext.woff2', LATIN_EXT),
  face('Bricolage Grotesque', '500 700', 'bricolage-grotesque-normal-500_700-latin.woff2', LATIN),
  ...['400', '500', '700'].flatMap(w => [
    face('Inter Tight', w, `inter-tight-normal-${w}-latin-ext.woff2`, LATIN_EXT),
    face('Inter Tight', w, `inter-tight-normal-${w}-latin.woff2`, LATIN)
  ])
].join('\n');

const CSS = `
.kmc{
  --bg:#F8F6FB; --ink:#1E1433; --purple:#5B2E91;
  --hair:rgba(30,20,51,.18); --hair-strong:rgba(30,20,51,.85);
  --soft:#EFEAF6;
  background:var(--bg);color:var(--ink);font:400 18px/1.65 "Inter Tight",system-ui,sans-serif;
  -webkit-text-size-adjust:100%;
}
.kmc *{box-sizing:border-box;margin:0;padding:0}
.kmc a{color:var(--purple);text-underline-offset:3px}
.kmc .wrap{max-width:720px;margin:0 auto;padding:0 24px}

.kmc .hdr{padding:88px 0 56px}
.kmc .eyebrow{font:700 12px/1 "Inter Tight",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--purple)}
.kmc h1{font:700 clamp(44px,7vw,76px)/.95 "Bricolage Grotesque",sans-serif;letter-spacing:-.025em;margin:20px 0 28px}
.kmc h1 em,.kmc h2 em,.kmc .pull em,.kmc .closing em{font-style:normal;color:var(--purple)}
.kmc .dek{font-size:22px;line-height:1.5;max-width:620px}
.kmc .byline{display:flex;gap:18px;align-items:center;margin-top:36px;padding-top:24px;border-top:1px solid var(--hair);font-size:14px}
.kmc .byline b{font-weight:700}
.kmc .byline .dot{width:4px;height:4px;border-radius:50%;background:var(--purple)}

.kmc article{padding-bottom:40px}
.kmc article p{margin:0 0 22px}
.kmc h2{font:700 clamp(30px,4.2vw,40px)/1.05 "Bricolage Grotesque",sans-serif;letter-spacing:-.015em;margin:72px 0 22px}
.kmc .sec-num{display:block;font:700 12px "Inter Tight",system-ui,sans-serif;letter-spacing:.14em;color:var(--purple);margin-bottom:14px}
.kmc strong{font-weight:700}

.kmc .pull{font:700 clamp(28px,4vw,38px)/1.12 "Bricolage Grotesque",sans-serif;letter-spacing:-.015em;margin:56px 0;padding:28px 0;border-top:2px solid var(--purple);border-bottom:1px solid var(--hair)}

.kmc .timeline{display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid var(--hair-strong);margin:36px 0 40px}
.kmc .timeline > div{padding:16px 14px 0 0;border-right:1px solid var(--hair)}
.kmc .timeline > div:last-child{border-right:0}
.kmc .timeline .yr{font:700 13px "Inter Tight",system-ui,sans-serif;letter-spacing:.1em;color:var(--purple);text-transform:uppercase}
.kmc .timeline .t{font:700 17px/1.15 "Bricolage Grotesque",system-ui,sans-serif;margin:6px 0 6px}
.kmc .timeline .d{font-size:14px;line-height:1.45}

.kmc .layers{margin:44px 0;border:1px solid var(--hair-strong);background:#fff}
.kmc .layer{padding:22px 26px;display:grid;grid-template-columns:150px 1fr;gap:18px;align-items:center}
.kmc .layer + .layer{border-top:1px solid var(--hair)}
.kmc .layer .lbl{font:700 11px "Inter Tight",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--purple)}
.kmc .layer .nm{font:700 21px/1.1 "Bricolage Grotesque",system-ui,sans-serif}
.kmc .layer .ds{font-size:15px;margin-top:4px}
.kmc .layer.agentic{background:var(--purple);color:#fff}
.kmc .layer.agentic .lbl{color:#fff;opacity:.8}
.kmc .flow{display:flex;justify-content:space-between;padding:10px 26px;font:700 11px "Inter Tight",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--purple);background:var(--soft);border-top:1px solid var(--hair);border-bottom:1px solid var(--hair)}

.kmc .two{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--hair-strong);margin:36px 0 40px}
.kmc .two > div{padding:24px 26px}
.kmc .two > div + div{border-left:1px solid var(--hair-strong)}
.kmc .two .k,.kmc .tiers .k{font:700 11px "Inter Tight",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--purple)}
.kmc .two .h{font:700 22px/1.1 "Bricolage Grotesque",system-ui,sans-serif;margin:8px 0 8px}
.kmc .two p{font-size:15.5px;margin:0}

.kmc ol.rules{list-style:none;margin:30px 0 40px;border-top:1px solid var(--hair-strong)}
.kmc ol.rules li{display:grid;grid-template-columns:56px 1fr;padding:18px 0;border-bottom:1px solid var(--hair)}
.kmc ol.rules .n{font:700 13px "Inter Tight",system-ui,sans-serif;color:var(--purple);padding-top:4px}
.kmc ol.rules b{font-weight:700}

.kmc .tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid var(--hair-strong);margin:30px 0 40px}
.kmc .tiers > div{padding:22px}
.kmc .tiers > div + div{border-left:1px solid var(--hair-strong)}
.kmc .tiers .h{font:700 20px/1.1 "Bricolage Grotesque",system-ui,sans-serif;margin:8px 0}
.kmc .tiers p{font-size:15px;margin:0}

.kmc .chain{display:flex;flex-wrap:wrap;align-items:stretch;gap:0;margin:30px 0 14px}
.kmc .chain .step{flex:1 1 0;min-width:120px;padding:16px 14px;border:1px solid var(--hair-strong);margin-right:-1px;background:#fff}
.kmc .chain .step.ai{background:var(--purple);color:#fff;border-color:var(--purple)}
.kmc .chain .k{font:700 11px "Inter Tight",system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;opacity:.85}
.kmc .chain .h{font:700 16px/1.2 "Bricolage Grotesque",system-ui,sans-serif;margin-top:6px}
.kmc .caption{font-size:14px;color:rgba(30,20,51,.75);margin-bottom:36px}

.kmc .takeaways{background:var(--purple);color:#fff;padding:44px 40px;margin:64px 0 40px}
.kmc .takeaways .eyebrow{color:#fff;opacity:.8}
.kmc .takeaways h3{font:700 32px/1.05 "Bricolage Grotesque",system-ui,sans-serif;margin:14px 0 24px}
.kmc .takeaways ol{list-style:none;counter-reset:t}
.kmc .takeaways li{counter-increment:t;display:grid;grid-template-columns:44px 1fr;padding:14px 0;border-top:1px solid rgba(255,255,255,.3);font-size:17px}
.kmc .takeaways li::before{content:counter(t,decimal-leading-zero);font:700 13px "Inter Tight",system-ui,sans-serif;padding-top:4px;opacity:.85}

.kmc .closing{font:700 clamp(30px,4.6vw,44px)/1.05 "Bricolage Grotesque",system-ui,sans-serif;letter-spacing:-.02em;margin:56px 0 24px}

.kmc figure.photo{margin:40px 0 36px}
.kmc figure.photo img{display:block;width:100%;height:auto;border:1px solid var(--hair)}
.kmc figure.photo.narrow{max-width:520px}
.kmc figure.photo figcaption{font-size:14px;color:rgba(30,20,51,.75);margin-top:10px}

.kmc .cta{border-top:1px solid var(--hair-strong);padding:44px 0 56px;margin-top:40px}
.kmc .cta p{margin:14px 0 18px}
.kmc .btn{display:inline-block;background:var(--purple);color:#fff;text-decoration:none;font:700 15px "Inter Tight",system-ui,sans-serif;padding:14px 22px}
.kmc .btn:hover{background:var(--ink)}

@media (max-width:680px){
  .kmc{font-size:17px}
  .kmc .hdr{padding:56px 0 40px}
  .kmc .timeline{grid-template-columns:1fr 1fr}
  .kmc .timeline > div{border-right:0;border-bottom:1px solid var(--hair);padding-bottom:14px}
  .kmc .layer{grid-template-columns:1fr;gap:6px}
  .kmc .two,.kmc .tiers{grid-template-columns:1fr}
  .kmc .two > div + div,.kmc .tiers > div + div{border-left:0;border-top:1px solid var(--hair-strong)}
  .kmc .chain{flex-direction:column}
  .kmc .chain .step{margin-right:0;margin-bottom:-1px}
  .kmc .takeaways{padding:32px 24px}
}
`;

const TIMELINE = [
  { yr: 'Rome', t: 'Contubernium', d: 'Eight soldiers per leader.' },
  { yr: '1806', t: 'Prussian staff', d: 'Middle management, formalised.' },
  { yr: '1855', t: 'A railroad', d: 'The New York & Erie draws the first org chart.' },
  { yr: '1911', t: 'Taylor', d: 'Managers think, workers do.' },
  { yr: 'Now', t: 'Same shape', d: 'Building a railway of its own.' }
];

const CHAIN = [
  { k: 'Site input', h: 'Voice note, photo, message' },
  { k: 'AI', h: 'Structures it, flags gaps', ai: true },
  { k: 'Owner', h: 'A named person approves' },
  { k: 'Dashboard', h: 'The shared picture updates' },
  { k: 'Decisions', h: 'On numbers everyone trusts' }
];

const RULES = [
  ['Every answer shows its source.', 'The row, the page, the message it came from.'],
  ['Every action has an owner.', 'A named person approves before anything goes out.'],
  ['Every change leaves a trail.', 'Who changed what, and when.'],
  ['Every number reconciles.', 'Totals add up, or the system flags it.']
];

const TIERS = [
  { k: 'Do freely', h: 'Read and draft.', p: 'Helps a person decide faster. Changes nothing on its own.' },
  { k: 'Ask first', h: 'Send and approve.', p: 'A named owner says yes before it happens.' },
  { k: 'Never', h: 'Personal data.', p: 'IDs, payroll, bank details and passwords stay out.' }
];

const TAKEAWAYS = [
  'Put every department in the room. AI is a systems change, and you can only see the system when all its nodes are present.',
  "Hierarchy was always a way to move information and trust. The question isn't whether to flatten it; it's what carries the information once people don't have to.",
  'The layer between management and the field can be agentic: reading, structuring, routing, drafting, so people can spend their time owning outcomes.',
  'AI supplies competence at scale. Goodwill stays human. Design so that a named person always has the final word.'
];

function Layer({ lbl, nm, ds, agentic }: { lbl: string; nm: string; ds: string; agentic?: boolean }) {
  return (
    <div className={agentic ? 'layer agentic' : 'layer'}>
      <div className="lbl">{lbl}</div>
      <div>
        <div className="nm">{nm}</div>
        <div className="ds">{ds}</div>
      </div>
    </div>
  );
}

function Flow() {
  return (
    <div className="flow">
      <span>↑ Data &amp; signal</span>
      <span>Plans &amp; actions ↓</span>
    </div>
  );
}

export function KmcCaseStudy() {
  return (
    <main className="min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: FONT_FACES + CSS }} />
      <SiteHeader />

      <div className="kmc">
        <div className="hdr">
          <div className="wrap">
            <div className="eyebrow">Field notes · Workshop · November 2026</div>
            <h1>
              Building an infrastructure of <em>trust.</em>
            </h1>
            <p className="dek">
              A full day with every head of department at KMC Constructions, and the lesson I keep coming back to: AI
              isn&apos;t a faster way to send reports up a hierarchy. It&apos;s a new layer for moving work, and trust,
              through the whole system.
            </p>
            <div className="byline">
              <span>
                <b>Rhea Karuturi</b>, Founder, Rhai
              </span>
              <span className="dot" />
              <span>6 min read</span>
            </div>
          </div>
        </div>

        <article>
          <div className="wrap">
            <h2>
              <span className="sec-num">01 · The room</span>Every head of department, <em>in one room.</em>
            </h2>
            <p>
              KMC Constructions has been building for more than fifty years. Today it&apos;s a ₹1,000+ crore company
              building government infrastructure projects, and it has just started a new railway build. That&apos;s a
              lot of people, sites and paperwork to keep in sync.
            </p>
            <p>
              Most AI trainings I&apos;m asked to run start with one team, usually the one that&apos;s most excited.
              This one started differently. Ananya Reddy decided to put every head of department in the same room for a
              full day: projects, quantity surveying, supply chain, plant and equipment, accounts, internal audit,
              company secretarial, HR, tenders, IT.
            </p>
            <p>That turned out to be the most important design decision of the day, and it was hers.</p>
            <p>
              When you teach one department, you teach a tool. When you teach every department at once, you can talk
              about the <strong>system</strong>: how information actually moves between people, where it gets stuck,
              and who has to vouch for it before anyone acts. Every head in that room is a node in that system. Each of
              them sends something up, receives something down, and checks something along the way.
            </p>
            <figure className="photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/img/writing/kmc-constructions/room.jpg"
                width={795}
                height={428}
                alt="Rhea Karuturi with KMC's heads of department in a conference room, the slide 'AI for KMC: Building an Infrastructure of Trust' on screen behind them."
              />
              <figcaption>KMC&apos;s heads of department at the end of the day.</figcaption>
            </figure>
            <p>
              We grounded everything in that railway project, so nothing was abstract. My one request at the start was
              honesty: tell me how things actually work, where updates get stuck, what&apos;s broken. The more honest
              the room, the better the output.
            </p>

            <h2>
              <span className="sec-num">02 · The old answer</span>For 2,000 years, people have{' '}
              <em>carried the information.</em>
            </h2>
            <p>
              Every company that works across distance faces the same question: how do you coordinate people who
              can&apos;t all see each other? A railway project makes it vivid. Kilometres of track, hundreds of people
              on site, one head office in another city.
            </p>
            <p>The answer we inherited is the military&apos;s: a nested hierarchy, defined by span of control.</p>

            <div className="timeline">
              {TIMELINE.map(x => (
                <div key={x.yr}>
                  <div className="yr">{x.yr}</div>
                  <div className="t">{x.t}</div>
                  <div className="d">{x.d}</div>
                </div>
              ))}
            </div>

            <p>
              The first modern org chart was drawn for a railroad, and we were discussing it inside a company building
              one. The catch is that more layers mean information moves slowly in both directions, and{' '}
              <strong>people have to carry it.</strong> For two thousand years there was no alternative. Now there is.
            </p>

            <h2>
              <span className="sec-num">03 · The new shape</span>From hierarchy <em>to intelligence.</em>
            </h2>
            <p>
              Jack Dorsey and Roelof Botha&apos;s 2026 essay on rebuilding Block makes the case that AI takes over the
              relaying, the part of the org that exists only to move information between layers. What sits between
              management and the field can be an <strong>agentic layer</strong>: it reads everything coming up from
              site, structures it, routes it to the person who owns it, and drafts the next action going back down.
            </p>

            <div
              className="layers"
              role="img"
              aria-label="Three layers: leadership at top, agentic layer in the middle, site and department teams at the bottom. Data and signal flow up, plans and actions flow down."
            >
              <Layer lbl="Leadership" nm="MD and heads of department" ds="Overall numbers. Decisions. Action plans." />
              <Flow />
              <Layer
                agentic
                lbl="The agentic layer"
                nm="Reads everything. Routes. Acts."
                ds="Structures site input, flags gaps, drafts the next step for a named owner."
              />
              <Flow />
              <Layer
                lbl="The field"
                nm="Site and department teams"
                ds="One daily headache, solved. A voice note instead of a spreadsheet."
              />
            </div>

            <p>Information goes up, plans come down, and fewer people have to spend their day being the wire in between.</p>

            <h2>
              <span className="sec-num">04 · The real problem</span>Moving data is easy. <em>Moving trust</em> is the
              hard part.
            </h2>
            <p>
              Here&apos;s where my own background came in. My undergraduate thesis at Stanford was on Aadhaar as trust
              infrastructure: how a billion people who&apos;ve never met come to trust each other at scale. The answer
              was never only technology. It was a system for deciding who to trust, and how to check.
            </p>
            <p>A company is the same problem at a smaller scale. The definition of trust I find most useful has two parts:</p>

            <div className="two">
              <div>
                <div className="k">Goodwill</div>
                <div className="h">Will you act in my interest?</div>
                <p>Intent. Do you care how this turns out, for me and for the company?</p>
              </div>
              <div>
                <div className="k">Competence</div>
                <div className="h">Can you actually do it?</div>
                <p>Skill. Do you know the work well enough to get it right?</p>
              </div>
            </div>

            <p>
              Today, trust flows through people. You believe the progress report because you trust the person who sent
              it. That works until the project is enormous and the person is three layers away.
            </p>
            <p>
              And when you look closely, <strong>a hierarchy is already a trust system.</strong> Every layer checks the
              one below it. The site engineer measures, the project manager confirms, QS checks quantities, internal
              audit checks the bill, accounts pays, the MD signs off. That&apos;s what the layers are for. It&apos;s
              also exactly why they&apos;re slow.
            </p>
            <p>
              AI changes one half of the equation. It brings <strong>competence at scale</strong>: a model can read
              every bill on the project, every site update, every indent. But it has no stake in the company. It brings
              no goodwill. So it never gets the final word.
            </p>

            <div className="pull">
              AI <em>structures.</em> People <em>verify.</em>
            </div>

            <div
              className="chain"
              role="img"
              aria-label="Site input flows to AI, which structures it; then to a named owner who approves; then to the dashboard; then to decisions."
            >
              {CHAIN.map(s => (
                <div key={s.k} className={s.ai ? 'step ai' : 'step'}>
                  <div className="k">{s.k}</div>
                  <div className="h">{s.h}</div>
                </div>
              ))}
            </div>
            <p className="caption">The agentic layer handles competence. Goodwill, and the final say, stay with people.</p>

            <h2>
              <span className="sec-num">05 · The rules</span>Trust, <em>but verify.</em>
            </h2>
            <p>If AI is going to sit inside the trust system, it has to play by rules the whole room can see. We wrote four down:</p>

            <ol className="rules">
              {RULES.map(([b, rest], i) => (
                <li key={b}>
                  <span className="n">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <b>{b}</b> {rest}
                  </span>
                </li>
              ))}
            </ol>

            <p>And then the boundaries, in the same language you&apos;d use to onboard a new hire:</p>

            <div className="tiers">
              {TIERS.map(t => (
                <div key={t.k}>
                  <div className="k">{t.k}</div>
                  <div className="h">{t.h}</div>
                  <p>{t.p}</p>
                </div>
              ))}
            </div>

            <h2>
              <span className="sec-num">06 · The build</span>Every head left with <em>their own page.</em>
            </h2>
            <p>
              Talk only goes so far. In the afternoon, each head of department sat with an AI interviewer that asked
              about their role, their day, and the one or two things they check every morning to know if things are on
              track. Out of that came a spec for their own page of a shared project dashboard: one briefing written
              fresh each morning, the headline numbers, a task board ranked by impact, and the detail underneath where
              the AI shows its work.
            </p>
            <p>
              Each department adds a column to the same picture. Schedule and progress, measured quantities, indents
              and deliveries, machine hours, bills raised and received. The dashboard stops being a report and becomes
              the company&apos;s interface to itself: the place where the picture lives, and where trust gets checked.
            </p>
            <p>
              The goal for the day was never mastery. It was <strong>an AI champion in every department</strong>:
              someone who has used it on real work, can see where it fits in their own function, and will help carry it
              forward.
            </p>

            <div className="takeaways">
              <div className="eyebrow">What I&apos;m taking away</div>
              <h3>Four lessons from the day</h3>
              <ol>
                {TAKEAWAYS.map(t => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </div>

            <figure className="photo narrow">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/img/writing/kmc-constructions/with-ananya.jpg"
                width={960}
                height={836}
                loading="lazy"
                alt="Rhea Karuturi and Ananya Reddy standing in front of the KMC sign."
              />
              <figcaption>With Ananya Reddy at KMC.</figcaption>
            </figure>

            <p className="closing">
              Every role is for an <em>outcome.</em> The tasks just get you there.
            </p>
            <p>
              The outcome stays with the person. They own it. The tasks, most of them anyway, go to agents. Getting
              that split right, and making it trustworthy, is the work I want to keep doing.
            </p>
            <p>
              As William Gibson put it, the future is already here; it&apos;s just not evenly distributed. For one day
              in November, it was distributed across every department at KMC. Now comes the part where they carry it
              forward.
            </p>

            <div className="cta">
              <div className="eyebrow">Work with Rhai</div>
              <p>
                Rhai runs hands-on AI days for leadership teams and builds the dashboards that come out of them. If
                you&apos;d like one for your company, I&apos;d love to hear from you.
              </p>
              <Link className="btn" href="/talk">
                Get in touch →
              </Link>
            </div>
          </div>
        </article>
      </div>

      <SiteFooter />
    </main>
  );
}
