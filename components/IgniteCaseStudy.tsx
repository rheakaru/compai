// Ignite.AI — "A room full of founders, each building their own chief of
// staff" — in the workshop deck's own design language: deep violet gradient,
// warm yellow accent, Bricolage Grotesque display over Inter Tight. Same
// pattern as KmcCaseStudy: every selector is scoped under `.ign` so nothing
// leaks into SiteHeader/SiteFooter, fonts are the vendored woff2 files in
// public/fonts, and photos live in public/img/writing/ignite-ai/.
//
// The markdown file content/writing/ignite-ai-chief-of-staff.md is only the
// archive listing; edit the copy here.

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
.ign{
  --night:#1B0B3D; --violet:#3A1A86; --bright:#7B2FF7; --yel:#FFD66B;
  --paper:#F7F4FC; --ink:#1B1230; --soft:#ECE6F8;
  --hair:rgba(27,18,48,.16); --hair-strong:rgba(27,18,48,.8);
  --dhair:rgba(255,255,255,.18);
  background:var(--paper);color:var(--ink);font:400 18px/1.65 "Inter Tight",system-ui,sans-serif;
  -webkit-text-size-adjust:100%;overflow-x:hidden;
}
.ign *{box-sizing:border-box;margin:0;padding:0}
.ign a{color:var(--violet);text-underline-offset:3px}
.ign .wrap{max-width:760px;margin:0 auto;padding:0 24px}
.ign .wide{max-width:1120px;margin:0 auto;padding:0 24px}
.ign .eyebrow{font:700 12px/1.3 "Inter Tight",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--bright)}
.ign .disp{font-family:"Bricolage Grotesque",sans-serif;font-weight:700;letter-spacing:-.02em}
.ign strong{font-weight:700}

/* dark bands share the deck's gradient */
.ign .dark{color:#fff;background:
  radial-gradient(60% 70% at 8% 0%, rgba(123,47,247,.55), transparent 70%),
  radial-gradient(50% 60% at 100% 100%, rgba(123,47,247,.7), transparent 70%),
  linear-gradient(160deg,#24104F 0%,var(--night) 55%,#2A1263 100%)}
.ign .dark .eyebrow{color:var(--yel)}
.ign .dark a{color:var(--yel)}
.ign .y{color:var(--yel)}
.ign .v{color:var(--bright)}

/* hero */
.ign .hero{padding:84px 0 0}
.ign .hero .meta{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center}
.ign .chip{display:inline-block;font:700 11px/1 "Inter Tight",sans-serif;letter-spacing:.12em;text-transform:uppercase;padding:8px 11px;border:1px solid var(--dhair);border-radius:999px;color:#fff}
.ign .chip.solid{background:var(--yel);color:var(--night);border-color:var(--yel)}
.ign h1{font:700 clamp(42px,7.4vw,88px)/.94 "Bricolage Grotesque",sans-serif;letter-spacing:-.03em;margin:28px 0 26px;max-width:980px}
.ign .dek{font-size:clamp(18px,2.2vw,22px);line-height:1.5;max-width:700px;color:rgba(255,255,255,.86)}
.ign .byline{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin-top:30px;font-size:14px;color:rgba(255,255,255,.75)}
.ign .byline b{color:#fff}
.ign .partners{display:flex;flex-wrap:wrap;gap:0;margin-top:44px;border-top:1px solid var(--dhair)}
.ign .partners > div{flex:1 1 180px;padding:18px 20px 18px 0;border-right:1px solid var(--dhair);margin-right:20px}
.ign .partners > div:last-child{border-right:0}
.ign .partners .k{font:700 10.5px "Inter Tight",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.ign .partners .n{font:700 22px/1.1 "Bricolage Grotesque",sans-serif;margin-top:6px}
.ign .hero-photo{margin-top:48px;position:relative}
.ign .hero-photo img{display:block;width:100%;height:auto;border-radius:14px 14px 0 0;max-height:640px;object-fit:cover}

/* stats strip */
.ign .stats{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--hair-strong)}
.ign .stats > div{padding:26px 20px 24px 0}
.ign .stats > div + div{padding-left:20px;border-left:1px solid var(--hair)}
.ign .stats .n{font:700 clamp(34px,4.6vw,52px)/1 "Bricolage Grotesque",sans-serif;letter-spacing:-.02em;color:var(--violet)}
.ign .stats .l{font-size:14px;line-height:1.4;margin-top:8px}

/* prose */
.ign article p{margin:0 0 22px}
.ign h2{font:700 clamp(32px,4.6vw,48px)/1.02 "Bricolage Grotesque",sans-serif;letter-spacing:-.02em;margin:18px 0 22px}
.ign h2 em{font-style:normal;color:var(--bright)}
.ign .dark h2 em{color:var(--yel)}
.ign section.s{padding:84px 0 20px}
.ign section.band{padding:84px 0 76px;margin:64px 0 0}
.ign .lead{font-size:21px;line-height:1.55}

/* four-part grid */
.ign .parts{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--hair-strong);margin:34px 0 10px;background:#fff}
.ign .parts > div{padding:22px 20px}
.ign .parts > div + div{border-left:1px solid var(--hair-strong)}
.ign .parts .k{font:700 12px "Inter Tight",sans-serif;letter-spacing:.12em;color:var(--bright)}
.ign .parts .h{font:700 26px/1.05 "Bricolage Grotesque",sans-serif;margin:10px 0 8px}
.ign .parts p{font-size:15px;line-height:1.5;margin:0}

/* seven keywords */
.ign .kw{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1px;background:var(--dhair);border:1px solid var(--dhair);margin:38px 0 0;border-radius:12px;overflow:hidden}
.ign .kw > div{background:rgba(27,11,61,.92);padding:22px 20px 24px}
.ign .kw .n{font:700 12px "Inter Tight",sans-serif;letter-spacing:.12em;color:var(--yel)}
.ign .kw .t{font:700 24px/1.05 "Bricolage Grotesque",sans-serif;margin:8px 0 8px}
.ign .kw p{font-size:15px;line-height:1.5;color:rgba(255,255,255,.82);margin:0}
.ign .kw .star{background:var(--yel);color:var(--night)}
@media (min-width:900px){.ign .kw .star{grid-column:span 2}}
.ign .kw .star .t{font-size:34px}
.ign .kw .star .n{color:var(--violet)}
.ign .kw .star p{color:var(--night)}

/* think / act / reflect */
.ign .loop{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:stretch;margin:36px 0 8px}
.ign .loop .step{border-top:3px solid var(--bright);padding:18px 0 0}
.ign .loop .arrow{align-self:center;padding:0 16px;font:700 28px "Bricolage Grotesque",sans-serif;color:var(--bright)}
.ign .loop .k{font:700 12px "Inter Tight",sans-serif;letter-spacing:.12em;color:var(--bright);text-transform:uppercase}
.ign .loop .h{font:700 26px/1.05 "Bricolage Grotesque",sans-serif;margin:8px 0}
.ign .loop p{font-size:15.5px;line-height:1.5;margin:0}
.ign .back{font-size:14px;color:rgba(27,18,48,.7);margin:16px 0 0}

/* onboarding table */
.ign table.onb{width:100%;border-collapse:collapse;margin:30px 0 36px;font-size:16px}
.ign table.onb th{font:700 11px "Inter Tight",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--bright);text-align:left;padding:0 0 10px;border-bottom:1px solid var(--hair-strong)}
.ign table.onb td{padding:14px 0;border-bottom:1px solid var(--hair);vertical-align:top}
.ign table.onb td:first-child{font-weight:700;width:34%;padding-right:16px}

/* photos */
.ign figure{margin:44px 0 40px}
.ign figure img{display:block;width:100%;height:auto;border-radius:12px}
.ign figcaption{font-size:14px;color:rgba(27,18,48,.7);margin-top:10px}
.ign .dark figcaption{color:rgba(255,255,255,.7)}
.ign .pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:44px 0 40px}
.ign .pair figure{margin:0}
.ign .pair img{aspect-ratio:5/4;object-fit:cover}

/* demos */
.ign .demos{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:34px 0 10px}
.ign .demo{border:1px solid var(--hair-strong);background:#fff;padding:22px 20px;border-radius:12px;display:flex;flex-direction:column}
.ign .demo .tag{align-self:flex-start;background:var(--yel);color:var(--night);font:700 10.5px "Inter Tight",sans-serif;letter-spacing:.12em;text-transform:uppercase;padding:6px 9px;border-radius:4px}
.ign .demo .h{font:700 22px/1.1 "Bricolage Grotesque",sans-serif;margin:14px 0 8px}
.ign .demo p{font-size:15px;line-height:1.5;margin:0}
.ign .demo.uncommon{background:var(--violet);color:#fff;border-color:var(--violet)}
.ign .pull{font:700 clamp(28px,4vw,40px)/1.1 "Bricolage Grotesque",sans-serif;letter-spacing:-.02em;margin:48px 0;padding:26px 0;border-top:3px solid var(--bright);border-bottom:1px solid var(--hair)}
.ign .pull em{font-style:normal;color:var(--bright)}

/* six questions */
.ign ol.six{list-style:none;margin:34px 0 10px;display:grid;grid-template-columns:1fr 1fr;gap:0 40px}
.ign ol.six li{display:grid;grid-template-columns:72px 1fr;align-items:baseline;padding:16px 0;border-top:1px solid var(--dhair)}
.ign ol.six .n{font:700 46px/1 "Bricolage Grotesque",sans-serif;color:var(--yel)}
.ign ol.six .q{font:700 20px/1.2 "Bricolage Grotesque",sans-serif}
.ign ol.six li.last .q{color:var(--yel)}
.ign .criterion{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--dhair);border-radius:12px;margin:34px 0 0;overflow:hidden}
.ign .criterion > div{padding:22px 24px}
.ign .criterion > div + div{border-left:1px solid var(--dhair);background:rgba(255,214,107,.1)}
.ign .criterion .k{font:700 11px "Inter Tight",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.ign .criterion .q{font:700 22px/1.2 "Bricolage Grotesque",sans-serif;margin-top:8px}

/* build steps */
.ign .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:32px 0 10px;border-top:1px solid var(--hair-strong)}
.ign .steps > div{padding:18px 18px 0 0}
.ign .steps .k{font:700 12px "Inter Tight",sans-serif;color:var(--bright);letter-spacing:.1em}
.ign .steps .h{font:700 21px/1.1 "Bricolage Grotesque",sans-serif;margin:8px 0 6px}
.ign .steps p{font-size:14.5px;line-height:1.5;margin:0}

.ign .credit{display:grid;grid-template-columns:auto 1fr;gap:28px;align-items:center;border-radius:16px;padding:30px 32px;margin:44px 0}
.ign .credit .amt{font:700 clamp(56px,8vw,88px)/.9 "Bricolage Grotesque",sans-serif;color:var(--yel);letter-spacing:-.03em}
.ign .credit .h{font:700 24px/1.15 "Bricolage Grotesque",sans-serif}
.ign .credit p{font-size:15.5px;margin:8px 0 0;color:rgba(255,255,255,.85)}

.ign .path{display:flex;flex-wrap:wrap;margin:28px 0 36px}
.ign .path > div{flex:1 1 150px;padding:16px 16px;border:1px solid var(--hair-strong);margin:0 -1px -1px 0;background:#fff}
.ign .path > div.aws{background:var(--violet);color:#fff;border-color:var(--violet)}
.ign .path .k{font:700 11px "Inter Tight",sans-serif;letter-spacing:.12em;text-transform:uppercase;opacity:.75}
.ign .path .h{font:700 18px/1.2 "Bricolage Grotesque",sans-serif;margin-top:6px}

/* agent vs human */
.ign .split{display:grid;grid-template-columns:1fr 1fr;margin:34px 0 10px;border:1px solid var(--hair-strong);border-radius:12px;overflow:hidden}
.ign .split > div{padding:26px 26px 22px}
.ign .split > div + div{background:var(--ink);color:#fff}
.ign .split .k{font:700 11px "Inter Tight",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--bright)}
.ign .split > div + div .k{color:var(--yel)}
.ign .split ul{list-style:none;margin-top:12px}
.ign .split li{font:700 22px/1.2 "Bricolage Grotesque",sans-serif;padding:10px 0;border-top:1px solid var(--hair)}
.ign .split > div + div li{border-top-color:var(--dhair)}
.ign .ibm{margin:40px 0;padding:34px 30px;background:#F1EEE6;border:1px solid var(--hair);border-radius:4px;text-align:center;font:500 clamp(15px,2vw,19px)/1.9 "Courier New",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:#222}
.ign .ibm + p.src{font-size:13px;color:rgba(27,18,48,.6);margin-top:-28px;text-align:center}

/* Anthropic section */
.ign .speaker{display:grid;grid-template-columns:1.25fr 1fr;gap:40px;align-items:center;margin-top:30px}
.ign .speaker img{display:block;width:100%;height:auto;border-radius:12px}
.ign .speaker .role{font-size:15px;color:rgba(255,255,255,.75);margin-top:8px}
.ign .speaker .name{font:700 clamp(34px,4.8vw,52px)/1 "Bricolage Grotesque",sans-serif;letter-spacing:-.02em}
.ign .speaker p{margin-top:18px;color:rgba(255,255,255,.88)}
.ign .fireside{margin-top:44px;border-top:1px solid var(--dhair);display:grid;grid-template-columns:repeat(4,1fr)}
.ign .fireside > div{padding:16px 16px 0 0}
.ign .fireside .n{font:700 18px/1.15 "Bricolage Grotesque",sans-serif}
.ign .fireside .o{font-size:13.5px;color:rgba(255,255,255,.7);margin-top:4px}

/* backend */
.ign .stack{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin:34px 0 10px}
.ign .tile{border:1px solid var(--hair-strong);border-radius:12px;padding:24px 22px;background:#fff;position:relative}
.ign .tile .k{font:700 11px "Inter Tight",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--bright)}
.ign .tile .h{font:700 23px/1.1 "Bricolage Grotesque",sans-serif;margin:8px 0 12px}
.ign .tile ul{list-style:none}
.ign .tile li{font-size:15px;line-height:1.45;padding:7px 0 7px 18px;border-top:1px solid var(--hair);position:relative}
.ign .tile li::before{content:"";position:absolute;left:0;top:15px;width:7px;height:7px;border-radius:50%;background:var(--bright)}
.ign .tile.pm{background:var(--violet);color:#fff;border-color:var(--violet)}
.ign .tile.pm .k{color:var(--yel)}
.ign .tile.pm li{border-top-color:var(--dhair)}
.ign .tile.pm li::before{background:var(--yel)}
.ign .btns{display:flex;gap:8px;margin-top:14px}
.ign .btns span{font:700 12px "Inter Tight",sans-serif;padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.14)}
.ign .btns span:first-child{background:var(--yel);color:var(--night)}

/* closing */
.ign .closing{font:700 clamp(34px,5.6vw,64px)/1 "Bricolage Grotesque",sans-serif;letter-spacing:-.03em;margin:0 0 26px}
.ign .closing em{font-style:normal;color:var(--yel)}
.ign .cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}
.ign .btn{display:inline-block;background:var(--yel);color:var(--night) !important;text-decoration:none;font:700 15px "Inter Tight",sans-serif;padding:14px 22px;border-radius:8px}
.ign .btn.ghost{background:transparent;color:#fff !important;border:1px solid var(--dhair)}
.ign .btn:hover{filter:brightness(1.05)}

@media (max-width:820px){
  .ign .parts,.ign .steps{grid-template-columns:1fr 1fr}
  .ign .parts > div:nth-child(3){border-left:0}
  .ign .parts > div:nth-child(n+3){border-top:1px solid var(--hair-strong)}
  .ign .demos{grid-template-columns:1fr}
  .ign .speaker{grid-template-columns:1fr}
  .ign .fireside{grid-template-columns:1fr 1fr}
}
@media (max-width:680px){
  .ign{font-size:17px}
  .ign .hero{padding:52px 0 0}
  .ign .partners > div{border-right:0;margin-right:0;padding:14px 0 0;flex-basis:45%}
  .ign .stats{grid-template-columns:1fr 1fr}
  .ign .stats > div:nth-child(3){border-left:0;padding-left:0}
  .ign .stats > div:nth-child(n+3){border-top:1px solid var(--hair)}
  .ign .loop{grid-template-columns:1fr}
  .ign .loop .arrow{transform:rotate(90deg);padding:10px 0;justify-self:start}
  .ign ol.six{grid-template-columns:1fr}
  .ign .criterion,.ign .split,.ign .stack,.ign .pair{grid-template-columns:1fr}
  .ign .criterion > div + div{border-left:0;border-top:1px solid var(--dhair)}
  .ign .credit{grid-template-columns:1fr;gap:12px;padding:26px 22px}
  .ign .lead{font-size:19px}
  .ign section.s{padding:64px 0 10px}
  .ign section.band{padding:64px 0 56px}
  .ign table.onb td:first-child{width:40%}
}
`;

const PARTS = [
  { k: '01', h: 'Define', p: 'What an LLM is, what an agent is, and what a chief of staff actually does.' },
  { k: '02', h: 'See', p: 'Live demos of the agents I use every day.' },
  { k: '03', h: 'Build', p: 'Everyone builds their own, one guided question at a time.' },
  { k: '04', h: 'Zoom out', p: 'What this means for roles, and for companies.' }
];

const KEYWORDS = [
  { t: 'LLM', p: 'Predicts the next word. That is the whole trick.' },
  { t: 'Prompt', p: 'It works because it is specific, not because of magic words.' },
  { t: 'Context', p: 'Everything the model can see at once. If it isn’t in there, the model doesn’t know it.' },
  { t: 'Connector', p: 'A plug into your tools, like the logins you hand a new hire. Start read-only.' },
  { t: 'Skill', p: 'A saved how-to it loads when the task matches. The SOP in the binder.' },
  { t: 'Project', p: 'A workspace with its own instructions and files. Where your chief of staff lives.' },
  { t: 'Agent', p: 'An LLM that can do things. A chatbot talks about your calendar. An agent opens it.', star: true }
];

const ONBOARDING = [
  ['A role', 'Instructions: who it is and what it’s for'],
  ['A briefing', 'Context: your company, your people, your priorities'],
  ['Logins', 'Tools: connectors to email, calendar and docs'],
  ['House rules', 'Boundaries: do freely, ask first, never'],
  ['Feedback', 'Memory: it gets better every time you correct it']
];

const QUESTIONS = [
  'Where do they meet you?',
  'What do they know on day one?',
  'When can they reach out, why, and how?',
  'What can they touch, and what can’t they?',
  'How do they speak, and what’s off limits?',
  'What should be true in a month because they exist?'
];

const STEPS = [
  { k: '01', h: 'New project', p: 'In Claude. Call it “Chief of Staff.”' },
  { k: '02', h: 'Add the guide', p: 'Upload the setup guide from the workshop page.' },
  { k: '03', h: 'Start a chat', p: 'Type: Start my chief of staff setup.' },
  { k: '04', h: 'Answer', p: 'One question at a time. Say “skip” whenever you like.' }
];

const BACKEND = [
  {
    k: 'Before the day',
    h: 'Bookings and payments',
    items: [
      'Razorpay checkout. A seat counts only once it’s paid',
      'Prices and discount codes checked on the server, never trusted from the browser',
      'GST invoices, and a link to add a GSTIN after booking',
      'A shareable “I’ll be there” badge for LinkedIn'
    ]
  },
  {
    k: 'For the committee',
    h: 'A phone-first workspace',
    items: [
      'Opened from a pinned WhatsApp link',
      'Run of show for both tracks, and a sponsor pipeline',
      'Attendee pace against target, plus workshop checklists',
      'Event-day logistics with owners, and a decisions log where any change can be undone'
    ]
  },
  {
    k: 'The agent',
    h: 'An AI project manager',
    pm: true,
    items: [
      'Scoped to the event. The team messages it and loops emails in',
      'A weekly rhythm of reminders that organisers can edit themselves',
      'Everyone gets their own list with three buttons:'
    ]
  },
  {
    k: 'On the day',
    h: 'The attendee side',
    items: [
      'A QR page for every session: ask a question, upvote the best ones, then rate it and leave a voice note',
      'A shared photo wall and networking bingo',
      'An end-of-day voice review',
      'A “built” page for showing what you made in the workshop'
    ]
  }
];

function Photo({ src, alt, caption, w, h }: { src: string; alt: string; caption?: string; w: number; h: number }) {
  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={w} height={h} loading="lazy" />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

export function IgniteCaseStudy() {
  return (
    <main className="min-h-screen bg-cream">
      <style dangerouslySetInnerHTML={{ __html: FONT_FACES + CSS }} />
      <SiteHeader />

      <div className="ign">
        {/* ── Hero ───────────────────────────────────────── */}
        <header className="dark hero">
          <div className="wide">
            <Link href="/writing" className="chip" style={{ textDecoration: 'none' }}>
              ← All writing
            </Link>
            <div className="meta" style={{ marginTop: 26 }}>
              <span className="chip solid">Ignite.AI</span>
              <span className="chip">19 Nov 2026 · Bengaluru</span>
              <span className="chip">Workshop</span>
            </div>
            <h1>
              A room full of founders, each building their own <span className="y">chief of staff.</span>
            </h1>
            <p className="dek">
              Notes from Ignite.AI in Bengaluru, a day by SonderConnect with Anthropic and AWS, where I ran the
              largest Rhai workshop yet. Everyone left with a working AI chief of staff. I also built the backend the
              conference ran on.
            </p>
            <div className="byline">
              <span>
                By <b>Rhea Karuturi</b>, Founder, Rhai
              </span>
              <span aria-hidden>·</span>
              <span>8 min read</span>
            </div>

            <div className="partners">
              <div>
                <div className="k">Hosted by</div>
                <div className="n">SonderConnect</div>
              </div>
              <div>
                <div className="k">Partner</div>
                <div className="n">Anthropic</div>
              </div>
              <div>
                <div className="k">Title sponsor</div>
                <div className="n">AWS</div>
              </div>
              <div>
                <div className="k">My session</div>
                <div className="n">
                  Build your <span className="y">Chief of Staff</span>
                </div>
              </div>
            </div>

            <div className="hero-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/img/writing/ignite-ai/hall.jpg"
                width={1600}
                height={1066}
                alt="Rhea presenting a context graph on the big screen to a packed hall at The Sabha, Bengaluru."
              />
            </div>
          </div>
        </header>

        <article>
          {/* ── Stats ───────────────────────────────────── */}
          <div className="wide">
            <div className="stats">
              <div>
                <div className="n">2 hrs</div>
                <div className="l">in the Main Hall, right after lunch</div>
              </div>
              <div>
                <div className="n">45 min</div>
                <div className="l">of it spent building, on everyone’s own laptop</div>
              </div>
              <div>
                <div className="n">$25</div>
                <div className="l">in Claude API credits per builder, from Anthropic</div>
              </div>
              <div>
                <div className="n">1</div>
                <div className="l">backend I built to run the whole conference</div>
              </div>
            </div>
          </div>

          {/* ── Intro ───────────────────────────────────── */}
          <section className="s">
            <div className="wrap">
              <p className="lead">
                On 19 November, SonderConnect ran <strong>Ignite.AI</strong> at The Sabha in Bengaluru: a full day for
                founders, operators and tech teams, with <strong>Anthropic</strong> and WhiteMatter as partners and{' '}
                <strong>AWS</strong> as title sponsor.
              </p>
              <p>
                There were two tracks. Tech teams spent the day in the Tech Hall, shipping agents on Amazon Bedrock
                AgentCore with AWS solutions architects and learning evals from Anthropic. Founders and operators had
                the Main Hall. My slot was the Main Hall after lunch: two hours called <em>Build your Chief of Staff
                agent</em>.
              </p>
              <p>
                It was <strong>the largest workshop I’ve run for Rhai.</strong> The round tables were full, laptops
                were open, and many people were building an agent for the first time.
              </p>

              <Photo
                src="/img/writing/ignite-ai/welcome.jpg"
                w={1600}
                h={1066}
                alt="Welcome and context setting on the Ignite.AI screen, with SonderConnect on stage."
                caption="10:30, Main Hall: welcome and context setting from SonderConnect."
              />

              <span className="eyebrow">A build, not just a talk</span>
              <h2>
                Leave with an agent, <em>not a plan to try one.</em>
              </h2>
              <p>
                People leave most AI talks with a few screenshots and a vague plan to “try it.” I wanted everyone to
                leave this one with a working agent built around their own week. The session had four parts:
              </p>
              <div className="parts">
                {PARTS.map(p => (
                  <div key={p.k}>
                    <div className="k">{p.k}</div>
                    <div className="h">{p.h}</div>
                    <p>{p.p}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Seven keywords (dark band) ──────────────── */}
          <section className="dark band">
            <div className="wrap">
              <span className="eyebrow">Define · very briefly</span>
              <h2>
                Seven words, <em>one sentence each.</em>
              </h2>
              <p style={{ color: 'rgba(255,255,255,.85)' }}>
                Before anyone built anything, we went through seven terms. The last one mattered most.
              </p>
            </div>
            <div className="wide">
              <div className="kw">
                {KEYWORDS.map((k, i) => (
                  <div key={k.t} className={k.star ? 'star' : undefined}>
                    <div className="n">{String(i + 1).padStart(2, '0')}</div>
                    <div className="t">{k.t}</div>
                    <p>{k.p}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="wrap">
              <div className="pair" style={{ marginBottom: 0 }}>
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/img/writing/ignite-ai/agent.jpg"
                    width={1600}
                    height={1280}
                    loading="lazy"
                    alt="Rhea on stage beside the slide '7. An Agent is an LLM that can do things.'"
                  />
                </figure>
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/img/writing/ignite-ai/loop.jpg"
                    width={1600}
                    height={1279}
                    loading="lazy"
                    alt="Rhea presenting the slide 'Think. Act. Reflect.' to the room."
                  />
                </figure>
              </div>
            </div>
          </section>

          {/* ── The loop + the analogy ──────────────────── */}
          <section className="s">
            <div className="wrap">
              <span className="eyebrow">The loop</span>
              <h2>
                Think. Act. <em>Reflect.</em>
              </h2>
              <p>Ask an agent to prep you for your 3pm, and here’s what happens:</p>
              <div className="loop">
                <div className="step">
                  <div className="k">01 · Think</div>
                  <div className="h">What’s needed?</div>
                  <p>The invite, and who’s on it.</p>
                </div>
                <div className="arrow" aria-hidden>
                  →
                </div>
                <div className="step">
                  <div className="k">02 · Act</div>
                  <div className="h">Use a tool.</div>
                  <p>Open the calendar. Search the inbox for the last thread with them.</p>
                </div>
                <div className="arrow" aria-hidden>
                  →
                </div>
                <div className="step">
                  <div className="k">03 · Reflect</div>
                  <div className="h">Is that enough?</div>
                  <p>If not, go round again. If so, write the brief.</p>
                </div>
              </div>
              <p className="back">↺ The loop repeats until the answer is good enough.</p>

              <span className="eyebrow" style={{ display: 'block', marginTop: 64 }}>
                The analogy we used all afternoon
              </span>
              <h2>
                An agent is a new hire <em>you have to onboard.</em>
              </h2>
              <table className="onb">
                <thead>
                  <tr>
                    <th>A new hire gets</th>
                    <th>An agent gets</th>
                  </tr>
                </thead>
                <tbody>
                  {ONBOARDING.map(([a, b]) => (
                    <tr key={a}>
                      <td>{a}</td>
                      <td>{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Most people in the room had onboarded a human before, so they knew more about building agents than
                they assumed.
              </p>
            </div>
          </section>

          {/* ── Demos ───────────────────────────────────── */}
          <section className="s">
            <div className="wrap">
              <span className="eyebrow">See · live demos</span>
              <h2>
                Then I showed <em>mine.</em>
              </h2>
              <p>All three demos ran on real systems I use, not mock-ups.</p>
            </div>
            <div className="wide">
              <div className="demos">
                <div className="demo">
                  <span className="tag">Live demo · Hoovu</span>
                  <div className="h">A puja flower company with an AI CEO</div>
                  <p>
                    It reads nine cities of orders, wastage and collections every morning, decides what matters today,
                    and says why.
                  </p>
                </div>
                <div className="demo">
                  <span className="tag">Live demo · Rhai</span>
                  <div className="h">The agent I work with every day</div>
                  <p>
                    On WhatsApp. A forwarded ticket becomes a calendar entry. When I asked for a meeting, it warned me
                    the slot clashed with the Ignite tech track before booking anything.
                  </p>
                </div>
                <div className="demo uncommon">
                  <span className="tag">The uncommon job</span>
                  <div className="h">An NDA, drafted and signed from a message</div>
                  <p>
                    “Make me an NDA for Hoovu Fresh.” It checks the legal entity name, and a few seconds later a
                    signed, dated PDF comes back.
                  </p>
                </div>
              </div>
            </div>
            <div className="wrap">
              <p className="pull">
                The common jobs are where everyone starts. <em>The uncommon job that’s particular to you</em> is what
                makes yours worth having.
              </p>
              <p>
                By common jobs I mean inbox checks on a schedule, a brief before every meeting, a morning brief and a
                weekly review. Nobody would put the NDA on a chief of staff’s job description, and that’s the point.
              </p>
            </div>
          </section>

          {/* ── Six questions (dark band) ───────────────── */}
          <section className="dark band">
            <div className="wrap">
              <span className="eyebrow">Which is why there’s no template</span>
              <h2>
                Six questions you’d answer <em>for a human, too.</em>
              </h2>
              <ol className="six">
                {QUESTIONS.map((q, i) => (
                  <li key={q} className={i === QUESTIONS.length - 1 ? 'last' : undefined}>
                    <span className="n">{String(i + 1).padStart(2, '0')}</span>
                    <span className="q">{q}</span>
                  </li>
                ))}
              </ol>
              <p style={{ marginTop: 30, color: 'rgba(255,255,255,.85)' }}>
                The last one does the most work, because it asks for a success criterion rather than a job
                description.
              </p>
              <div className="criterion">
                <div>
                  <div className="k">A task</div>
                  <div className="q">“Manage my calendar.”</div>
                </div>
                <div>
                  <div className="k">A success criterion</div>
                  <div className="q y">“I never walk into a meeting unprepared.”</div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Build ───────────────────────────────────── */}
          <section className="s">
            <div className="wrap">
              <span className="eyebrow">Build · 45 minutes</span>
              <h2>
                Now go <em>build it.</em>
              </h2>
              <p>
                The setup guide is on <Link href="/chief-of-staff-workshop">heyrhai.com/chief-of-staff-workshop</Link>
                . Getting started takes four steps:
              </p>
              <div className="steps">
                {STEPS.map(s => (
                  <div key={s.k}>
                    <div className="k">{s.k}</div>
                    <div className="h">{s.h}</div>
                    <p>{s.p}</p>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 30 }}>
                When a connector didn’t work, people skipped it and it went on a to-do list. When someone got stuck,
                they raised a hand and we came to their table. By the end, people had instructions, context files,
                skills for their three most important jobs, and draft-only schedules wherever their account allowed.
              </p>

              <Photo
                src="/img/writing/ignite-ai/tables.jpg"
                w={1600}
                h={1066}
                alt="Attendees working on laptops at round tables, with organisers helping."
                caption="The build, table by table."
              />

              <div className="credit dark">
                <div className="amt">$25</div>
                <div>
                  <div className="h">In Claude API credits for every builder, from Anthropic.</div>
                  <p>So the build didn’t have to stop when the session ended: in Claude Code, and as an always-on agent.</p>
                </div>
              </div>

              <p>From there, the path to an always-on agent is short:</p>
              <div className="path">
                <div>
                  <div className="k">01</div>
                  <div className="h">Export the project as one file</div>
                </div>
                <div>
                  <div className="k">02</div>
                  <div className="h">Hand it to Claude Code with the migration guide</div>
                </div>
                <div className="aws">
                  <div className="k">03 · AWS</div>
                  <div className="h">Host it so it keeps running when your laptop is closed</div>
                </div>
                <div>
                  <div className="k">04 · Optional</div>
                  <div className="h">Put it on WhatsApp and message it like a person</div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Zoom out ────────────────────────────────── */}
          <section className="s">
            <div className="wrap">
              <span className="eyebrow">Zoom out · the idea to take home</span>
              <h2>
                An agent is <em>not</em> a human.
              </h2>
              <p>Each one is good at what the other can’t be.</p>
              <div className="split">
                <div>
                  <div className="k">The agent can be</div>
                  <ul>
                    <li>Awake at 3am</li>
                    <li>Reading every email</li>
                    <li>Never forgetting a follow-up</li>
                  </ul>
                </div>
                <div>
                  <div className="k">Only a human can be</div>
                  <ul>
                    <li>Present in the room</li>
                    <li>Trusted with what’s unsaid</li>
                    <li>Held accountable</li>
                  </ul>
                </div>
              </div>

              <div className="ibm">
                A computer can never be held accountable
                <br />
                <br />
                Therefore a computer must never make a management decision
              </div>
              <p className="src">From an IBM training slide, 1979. It still applies.</p>

              <p>
                So don’t just digitise the job description. Every role exists for an outcome, and the tasks are how you
                get there. <strong>The outcome stays with the person. Most of the tasks can go to agents.</strong> The
                people at those tables were starting to sort their own work that way.
              </p>
            </div>
          </section>

          {/* ── Anthropic (dark band) ───────────────────── */}
          <section className="dark band">
            <div className="wide">
              <span className="eyebrow">Hearing from Anthropic</span>
              <div className="speaker">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/img/writing/ignite-ai/irina.jpg"
                  width={1600}
                  height={1280}
                  loading="lazy"
                  alt="Irina Ghose on stage presenting 'Sales, finance, and marketing build their own tools.'"
                />
                <div>
                  <div className="name">Irina Ghose</div>
                  <div className="role">Managing Director, Anthropic India · State of AI</div>
                  <p>
                    The day closed in the Main Hall with Irina’s <em>State of AI</em> talk. Her examples were close to
                    what we’d done that afternoon: sales, finance and marketing teams building their own tools, often
                    with no code, starting from work they already did.
                  </p>
                  <p>
                    Rhai’s work is built on Claude, so it meant a lot to share a stage with the Anthropic team, in a
                    room of Bengaluru founders who had built their first agent that afternoon.
                  </p>
                </div>
              </div>
              <div className="fireside">
                <div>
                  <div className="n">Fireside: Build. Scale. Lead.</div>
                  <div className="o">Moderated by Lathika Pai, Founder, SonderConnect</div>
                </div>
                <div>
                  <div className="n">Tiffany Bloomquist</div>
                  <div className="o">Director, Startups APJ, AWS</div>
                </div>
                <div>
                  <div className="n">Natasha Wallace</div>
                  <div className="o">People Partner, Anthropic</div>
                </div>
                <div>
                  <div className="n">Anuj Gupta</div>
                  <div className="o">Managing Director APJ, WhiteMatter</div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Backend ─────────────────────────────────── */}
          <section className="s">
            <div className="wrap">
              <span className="eyebrow">The part nobody saw</span>
              <h2>
                The conference ran on a <em>dashboard I built.</em>
              </h2>
              <p>
                I built SonderConnect’s event backend in the weeks before Ignite.AI. By the day itself, it was handling
                most of the operations.
              </p>
            </div>
            <div className="wide">
              <div className="stack">
                {BACKEND.map(b => (
                  <div key={b.h} className={b.pm ? 'tile pm' : 'tile'}>
                    <div className="k">{b.k}</div>
                    <div className="h">{b.h}</div>
                    <ul>
                      {b.items.map(i => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                    {b.pm && (
                      <div className="btns" aria-label="Done, More time, Blocked">
                        <span>Done</span>
                        <span>More time</span>
                        <span>Blocked</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="wrap">
              <p className="pull">
                A conference about building with AI, organised by a small committee <em>working with an agent.</em>
              </p>
              <p>That was the workshop’s point, played out at the scale of a whole conference.</p>
            </div>
          </section>

          {/* ── Close ───────────────────────────────────── */}
          <section className="dark band" style={{ marginTop: 48 }}>
            <div className="wrap">
              <span className="eyebrow">Thank you</span>
              <p className="closing" style={{ marginTop: 16 }}>
                The future is here. <em>Let’s get our hands dirty with it.</em>
              </p>
              <p style={{ color: 'rgba(255,255,255,.88)' }}>
                Thanks to Lathika Pai and the SonderConnect team for building the day. Thanks to{' '}
                <strong>Anthropic</strong> for partnering, for the credits and for Irina’s talk, and to{' '}
                <strong>AWS</strong> for sponsoring the day and running the tech track. And thank you to everyone at
                the Main Hall tables who built a chief of staff with me. I want to see how it’s doing in a month.
              </p>
              <div className="cta">
                <Link className="btn" href="/talk">
                  Bring this workshop to your team →
                </Link>
                <Link className="btn ghost" href="/chief-of-staff-workshop">
                  Get the workshop guides
                </Link>
              </div>
            </div>
          </section>
        </article>
      </div>

      <SiteFooter />
    </main>
  );
}
