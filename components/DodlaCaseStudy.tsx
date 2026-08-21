// The Dodla Dairy engagement, in its own design language rather than the
// site's editorial-prose template. This one is proof-of-work — the graph-paper
// canvas, the stat strip, the stepper, the navy dashboard mock, the dark
// reframe band — so it keeps the layout it was written in.
//
// Every selector is scoped under `.dodla`. The original was a standalone HTML
// file that styled `body`, `h2`, `blockquote` and friends globally; unscoped,
// those would leak into SiteHeader/SiteFooter and every other page that shares
// this bundle.
//
// The three faces are vendored in public/fonts and declared below. They are
// NOT loaded via next/font, which fetches from Google during `next build` and
// so makes the deploy depend on the build sandbox's network egress. Shipping
// the files keeps the build hermetic and the runtime free of external font
// requests; only this page pays for them, since nothing else uses these vars.

import Link from 'next/link';
import { SiteFooter, SiteHeader } from './SiteChrome';

const FONT_FACES = `
@font-face {
  font-family: 'Fraunces';
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url(/fonts/fraunces-italic-400-latin-ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'Fraunces';
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url(/fonts/fraunces-italic-400-latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Fraunces';
  font-style: italic;
  font-weight: 600;
  font-display: swap;
  src: url(/fonts/fraunces-italic-600-latin-ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'Fraunces';
  font-style: italic;
  font-weight: 600;
  font-display: swap;
  src: url(/fonts/fraunces-italic-600-latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Fraunces';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(/fonts/fraunces-normal-400-latin-ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'Fraunces';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(/fonts/fraunces-normal-400-latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Fraunces';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(/fonts/fraunces-normal-600-latin-ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'Fraunces';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(/fonts/fraunces-normal-600-latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Fraunces';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(/fonts/fraunces-normal-700-latin-ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'Fraunces';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(/fonts/fraunces-normal-700-latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Inter Tight';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(/fonts/inter-tight-normal-400-latin-ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'Inter Tight';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(/fonts/inter-tight-normal-400-latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Inter Tight';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(/fonts/inter-tight-normal-500-latin-ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'Inter Tight';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(/fonts/inter-tight-normal-500-latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Inter Tight';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(/fonts/inter-tight-normal-600-latin-ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'Inter Tight';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(/fonts/inter-tight-normal-600-latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Inter Tight';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(/fonts/inter-tight-normal-700-latin-ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'Inter Tight';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(/fonts/inter-tight-normal-700-latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(/fonts/jetbrains-mono-normal-400-latin-ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(/fonts/jetbrains-mono-normal-400-latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(/fonts/jetbrains-mono-normal-500-latin-ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(/fonts/jetbrains-mono-normal-500-latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
`;

const CSS = `
.dodla{
  --dodla-serif:'Fraunces', Georgia, 'Times New Roman', serif;
  --dodla-sans:'Inter Tight', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --dodla-mono:'JetBrains Mono', Menlo, 'Courier New', monospace;
  --cream:#f6f2ea; --cream2:#efe9dc; --paper:#fbf9f4; --ink:#1a1a17;
  --acc:#c64a1f; --tint:#fbe1d3;
  --muted:#726a5d; --line:#e2dccf;
  --navy:#14202e; --navy2:#0f1824; --blue:#2a72d0;
  background:var(--cream); color:var(--ink); font-family:var(--dodla-sans);
  font-size:18px; line-height:1.65; -webkit-font-smoothing:antialiased;
  background-image:
    linear-gradient(rgba(26,26,23,0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(26,26,23,0.035) 1px, transparent 1px);
  background-size:28px 28px;
}
.dodla *{ box-sizing:border-box; margin:0; padding:0; }
.dodla .wrap{ max-width:960px; margin:0 auto; padding:0 26px; }

/* type helpers */
.dodla .kicker{ font-family:var(--dodla-mono); font-size:13px; letter-spacing:.28em; text-transform:uppercase;
  color:var(--acc); font-weight:500; }
.dodla h2{ font-family:var(--dodla-serif); font-weight:600; font-size:40px; line-height:1.15; margin:14px 0 18px; letter-spacing:-.01em; }
.dodla h2 em{ font-style:italic; color:var(--acc); }
.dodla .sec{ padding:74px 0 30px; }
.dodla .sec-intro{ max-width:680px; color:var(--muted); font-size:19px; }
.dodla p + p{ margin-top:18px; }
.dodla .prose{ max-width:720px; }
.dodla .prose b{ font-weight:600; }

/* hero */
.dodla .hero{ border-bottom:1px solid var(--line);
  background:
    radial-gradient(ellipse 70% 55% at 82% 8%, rgba(198,74,31,.10), transparent 60%),
    radial-gradient(ellipse 55% 45% at 8% 96%, rgba(198,74,31,.06), transparent 60%),
    var(--cream); }
.dodla .hero-inner{ max-width:960px; margin:0 auto; padding:56px 26px 64px; }
.dodla .brandrow{ display:flex; align-items:center; gap:16px; margin-bottom:58px; flex-wrap:wrap; }
.dodla .rhai-mark{ display:flex; align-items:center; gap:9px; font-family:var(--dodla-serif); font-size:26px; font-weight:600; }
.dodla .rhai-mark i{ width:15px; height:15px; border-radius:50%; background:var(--acc); }
.dodla .brandrow .rule{ width:1px; height:26px; background:var(--line); }
.dodla .brandrow .tag{ font-family:var(--dodla-mono); font-size:12.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); }
.dodla .backlink{ margin-left:auto; font-family:var(--dodla-mono); font-size:12px; letter-spacing:.1em;
  text-transform:uppercase; color:var(--muted); text-decoration:none; }
.dodla .backlink:hover{ color:var(--acc); }
.dodla .hero h1{ font-family:var(--dodla-serif); font-weight:700; font-size:clamp(42px, 6.4vw, 68px); line-height:1.06;
  letter-spacing:-.015em; max-width:860px; margin:16px 0 24px; }
.dodla .hero h1 em{ font-style:italic; font-weight:600; color:var(--acc); }
.dodla .lede{ font-size:21px; line-height:1.6; color:var(--muted); max-width:700px; }
.dodla .lede em{ font-style:italic; }
.dodla .byline{ margin-top:26px; font-family:var(--dodla-mono); font-size:13.5px; color:var(--muted); letter-spacing:.04em; }
.dodla .byline b{ color:var(--ink); font-weight:500; }
.dodla .stat-strip{ display:grid; grid-template-columns:repeat(3, 1fr); gap:1px; margin-top:44px;
  border:1px solid var(--line); border-radius:16px; overflow:hidden; background:var(--line); }
.dodla .stat{ padding:20px 24px; background:var(--paper); }
.dodla .stat .n{ font-family:var(--dodla-serif); font-size:32px; font-weight:700; color:var(--ink); line-height:1.1; }
.dodla .stat .n span{ color:var(--acc); }
.dodla .stat .l{ font-family:var(--dodla-mono); font-size:11.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin-top:6px; }

/* tour stepper */
.dodla .tour{ margin-top:34px; border-left:2px solid var(--line); padding-left:0; max-width:760px; }
.dodla .grp{ font-family:var(--dodla-mono); font-size:12px; letter-spacing:.22em; text-transform:uppercase; color:var(--acc);
  margin:38px 0 6px 34px; font-weight:500; }
.dodla .tour .grp:first-child{ margin-top:6px; }
.dodla .step{ position:relative; padding:16px 0 16px 34px; }
.dodla .step .dot{ position:absolute; left:-8px; top:24px; width:14px; height:14px; border-radius:50%;
  background:var(--cream); border:3px solid var(--acc); }
.dodla .step h4{ font-family:var(--dodla-serif); font-size:21px; font-weight:600; margin-bottom:6px; }
.dodla .step p{ color:var(--muted); font-size:17px; max-width:640px; }

/* browser mock */
.dodla .mock{ border:1px solid var(--line); border-radius:18px; overflow:hidden; background:var(--navy);
  box-shadow:0 26px 60px rgba(26,26,23,.14); margin-top:40px; }
.dodla .mock-bar{ display:flex; align-items:center; gap:8px; background:var(--navy2); padding:12px 18px; }
.dodla .mock-bar i{ width:11px; height:11px; border-radius:50%; background:#2c3a4b; display:inline-block; }
.dodla .mock-bar .t{ margin-left:12px; font-family:var(--dodla-mono); font-size:12px; color:#7d93ad; letter-spacing:.06em; }
.dodla .mock-body{ padding:26px 28px 30px; color:#e8edf4; }
.dodla .mock-body .mk-kick{ font-family:var(--dodla-mono); font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:#7d93ad; }
.dodla .mock-body h5{ font-family:var(--dodla-serif); font-size:24px; font-weight:600; color:#fff; margin:8px 0 18px; }
.dodla .mk-kpis{ display:flex; flex-wrap:wrap; gap:12px; }
.dodla .mk-kpi{ flex:1 1 160px; background:rgba(42,114,208,.12); border:1px solid rgba(42,114,208,.35);
  border-radius:12px; padding:14px 16px; }
.dodla .mk-kpi b{ display:block; font-family:var(--dodla-serif); font-size:24px; font-weight:700; color:#fff; }
.dodla .mk-kpi span{ font-family:var(--dodla-mono); font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:#8fa7c2; }
.dodla .mk-kpi .bar{ height:7px; border-radius:4px; background:var(--blue); margin-top:10px; }
.dodla .mk-kpi.warn{ background:rgba(165,47,47,.14); border-color:rgba(165,47,47,.5); }
.dodla .mk-kpi.warn b{ color:#ff9d9d; }
.dodla .mk-note{ margin-top:16px; border:1px solid rgba(232,237,244,.16); border-radius:12px; padding:14px 16px;
  font-size:14.5px; color:#c3cfdd; line-height:1.55; }
.dodla .mk-note b{ color:#fff; font-weight:600; }
.dodla .mk-note .who{ font-family:var(--dodla-mono); font-size:10.5px; letter-spacing:.16em; text-transform:uppercase; color:#8fa7c2; display:block; margin-bottom:6px; }
.dodla .cap{ font-family:var(--dodla-serif); font-style:italic; font-size:15.5px; color:var(--muted); margin-top:14px; text-align:center; }

/* principle grid */
.dodla .princ{ display:grid; grid-template-columns:repeat(auto-fit, minmax(270px, 1fr)); gap:18px; margin-top:36px; }
.dodla .pcard{ background:var(--paper); border:1px solid var(--line); border-radius:16px; padding:26px 26px 24px; }
.dodla .pcard .pn{ font-family:var(--dodla-mono); font-size:12.5px; color:var(--acc); letter-spacing:.14em; font-weight:500; }
.dodla .pcard h4{ font-family:var(--dodla-serif); font-size:21px; font-weight:600; margin:10px 0 10px; line-height:1.25; }
.dodla .pcard p{ font-size:16px; color:var(--muted); }
.dodla .pcard p em{ font-style:italic; }
.dodla .pcard .map{ margin-top:14px; padding-top:12px; border-top:1px dashed var(--line); font-size:14.5px; color:var(--ink); }
.dodla .pcard .map b{ color:var(--acc); font-weight:600; }

/* aside / fact box */
.dodla .aside-box{ background:var(--cream2); border:1px solid var(--line); border-radius:18px;
  padding:30px 32px; margin-top:44px; }
.dodla .aside-box .kicker{ margin-bottom:12px; display:block; }
.dodla .facts{ display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:8px 28px; }
.dodla .facts li{ list-style:none; font-size:16px; color:var(--ink); padding:9px 0; border-bottom:1px dashed var(--line); }
.dodla .facts li b{ font-weight:600; }

/* dark thesis band */
.dodla .band{ background:#0d0d0b; color:#f2ede2; margin-top:80px; }
.dodla .band-inner{ max-width:960px; margin:0 auto; padding:84px 26px 88px; }
.dodla .band .kicker{ color:var(--tint); }
.dodla .band h2{ color:#fff; }
.dodla .band .prose{ color:#b9b2a4; }
.dodla .band .prose b{ color:#f2ede2; }
.dodla .bigquote{ font-family:var(--dodla-serif); font-style:italic; font-weight:600; font-size:clamp(30px, 4.6vw, 46px);
  line-height:1.24; max-width:820px; margin:30px 0 34px; color:#fff; }
.dodla .bigquote span{ color:var(--tint); }
.dodla .band-foot{ display:flex; justify-content:space-between; border-top:1px solid #2a2822; margin-top:56px; padding-top:20px;
  font-family:var(--dodla-mono); font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:#6b655a; }

/* ladder */
.dodla .ladder{ margin-top:34px; max-width:760px; }
.dodla .rung{ display:flex; gap:22px; align-items:baseline; padding:20px 4px; border-bottom:1px solid var(--line); }
.dodla .rung .r{ font-family:var(--dodla-serif); font-size:26px; font-weight:700; color:var(--acc); min-width:44px; }
.dodla .rung .rt{ font-family:var(--dodla-serif); font-size:20px; font-weight:600; min-width:230px; }
.dodla .rung .rd{ color:var(--muted); font-size:16.5px; }

/* pull quote + close */
.dodla blockquote{ font-family:var(--dodla-serif); font-style:italic; font-size:30px; line-height:1.4; font-weight:600;
  max-width:760px; margin:56px auto 0; text-align:center; color:var(--ink); }
.dodla blockquote span{ color:var(--acc); }
.dodla .badges{ display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin-top:40px; }
.dodla .badge{ font-family:var(--dodla-mono); font-size:12.5px; letter-spacing:.06em; border:1px solid var(--line);
  background:var(--paper); border-radius:999px; padding:8px 18px; color:var(--muted); }

/* the tier note that ties the story back to what Rhai sells */
.dodla .tiernote{ max-width:760px; margin:40px auto 0; padding-top:22px; border-top:1px solid var(--line);
  text-align:center; font-size:15.5px; color:var(--muted); }
.dodla .tiernote a{ color:var(--acc); text-decoration:none; border-bottom:1px solid rgba(198,74,31,.35); }
.dodla .tiernote a:hover{ border-bottom-color:var(--acc); }

.dodla .closing{ padding-bottom:80px; }

@media (max-width:640px){
  .dodla .sec{ padding:56px 0 22px; }
  .dodla h2{ font-size:32px; }
  .dodla .rung{ flex-wrap:wrap; gap:6px 18px; }
  .dodla .rung .rt{ min-width:0; }
  .dodla .band-foot{ flex-direction:column; gap:6px; }
}
@media (max-width:560px){ .dodla .stat-strip{ grid-template-columns:repeat(2, 1fr); } }
`;

const STATS: Array<[string, string, boolean?]> = [
  ['2', 'days on site'],
  ['2', 'months of conversations'],
  ['3', 'working sessions'],
  ['65', 'dashboards shared back & forth'],
  ['70', 'demo dashboard pages', true],
  ['1', 'reframe that mattered']
];

const PRINCIPLES = [
  {
    pn: '01 · FRAME',
    h: 'The frame beats the artifact',
    p: (
      <>
        Whatever you build, it will try to become the purpose. Guard the frame ferociously — the artifact is
        just the excuse to get everyone thinking in the same direction.
      </>
    ),
    map: <>&ldquo;rethink the company with AI&rdquo; survived; &ldquo;admire the dashboard&rdquo; didn&apos;t.</>
  },
  {
    pn: '02 · CHAMPIONS',
    h: 'Champions compound',
    p: (
      <>
        One internal champion gets you in the door. But when the seniormost people in the room lean in,
        something shifts — suddenly people are being called <em>into</em> the room mid-session.
      </>
    ),
    map: <>department heads were offered a 1-hour version of the deep-dives. They chose the full 3 hours. That&apos;s the real yes.</>
  },
  {
    pn: '03 · PERSONAS',
    h: 'Every room has five people',
    p: (
      <>
        The next-gen champion. The founder-leader with the most knowledge and the most gravity. The reluctant
        one whose conversion signals success to everyone. The quietly confident one. And the information
        powerhouse who stays silent unless explicitly invited — often because of language.
      </>
    ),
    map: <>learning to fuel the session with all five, instead of managing around them.</>
  },
  {
    pn: '04 · LANGUAGE',
    h: 'Say the language thing up front',
    p: (
      <>
        An announcement at the start — <em>share in whichever language you&apos;re comfortable in</em> — costs
        ten seconds and can unlock the most knowledgeable person in the room.
      </>
    ),
    map: <>my clearest improvement for next time. AI handles vernacular beautifully; the room should too.</>
  },
  {
    pn: '05 · FLOW',
    h: 'The best sign: they ask your question',
    p: (
      <>
        When a leader turns to a colleague and organically asks the exact question you were building toward,
        the session has become theirs. That&apos;s the goal — a conversation that no longer needs you.
      </>
    ),
    map: <>it happened before I even reached the brainstorm slide. Best moment of day one.</>
  },
  {
    pn: '06 · SCOPE',
    h: 'Cross-functional is a choice, not a default',
    p: (
      <>
        With a large company the danger is fragmentation — you could scope tighter and go deeper. But a
        company that already has data and views everywhere may genuinely need the connective,
        cross-functional layer first. Match the scope to the company&apos;s stage, not to your comfort.
      </>
    ),
    map: <>they had the dashboards. What was missing was the intelligence between them.</>
  }
];

const FACTS = [
  <>🐄 A cow&apos;s <b>muzzle print is unique</b> — nature shipped biometric ID first.</>,
  <>🔬 Milk is tested on <b>40 quality parameters</b> before it reaches you.</>,
  <>❄️ It&apos;s chilled to <b>under 5°C</b> minutes from the farmer, via heat exchanger.</>,
  <>🏭 They implemented <b>SAP unusually early</b> — an edge that explains their data culture to this day.</>,
  <>🥛 A tour of the milk process here is called a <b>&ldquo;Paal Yatra&rdquo;</b> — and yes, it&apos;s as delightful as it sounds.</>,
  <>📱 Field executives are a <b>high-touch army</b> — there are more milk-field-tracking apps than you&apos;d believe.</>
];

export function DodlaCaseStudy() {
  return (
    <main className="min-h-screen bg-cream text-ink-900">
      <style dangerouslySetInnerHTML={{ __html: FONT_FACES + CSS }} />
      <SiteHeader />

      <div className="dodla">
        {/* HERO */}
        <header className="hero">
          <div className="hero-inner">
            <div className="brandrow">
              <div className="rhai-mark">
                <i />
                Rhai
              </div>
              <div className="rule" />
              <div className="tag">field notes · a real engagement</div>
              <Link href="/writing" className="backlink">
                ← All writing
              </Link>
            </div>
            <p className="kicker">Proof of work · AI advisory</p>
            <h1>
              Two days inside a dairy company, rethinking it <em>with</em> AI.
            </h1>
            <p className="lede">
              In August 2026 I got to work with Dodla Dairy — one of India&apos;s largest listed dairy companies
              — on an engagement I&apos;d been dreaming about: not &ldquo;let&apos;s automate something,&rdquo; but{' '}
              <em>let&apos;s sit with the whole leadership team and rethink what this company is, now that AI exists.</em>{' '}
              Here&apos;s what we did, and what it taught me.
            </p>
            <p className="byline">
              <b>Rhea Karuturi</b> · Rhai Consulting Group · August 2026
            </p>

            <div className="stat-strip">
              {STATS.map(([n, l, plus]) => (
                <div className="stat" key={l}>
                  <div className="n">
                    {n}
                    {plus ? <span>+</span> : null}
                  </div>
                  <div className="l">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* SHAPE OF THE ENGAGEMENT */}
        <section className="sec">
          <div className="wrap">
            <p className="kicker">§ 01 · The shape of it</p>
            <h2>
              What we actually <em>did</em>
            </h2>
            <p className="sec-intro">
              The engagement had a simple spine: understand the company, build a thinking tool, then get the
              whole leadership into a room and work.
            </p>

            <div className="tour">
              <p className="grp">Before</p>
              <div className="step">
                <span className="dot" />
                <h4>The recce</h4>
                <p>
                  Discovery calls across departments, reading everything public, and mapping how the company
                  actually runs — who owns which decision, and which document each person opens every morning.
                  That last question tells you where the real data lives, and where it doesn&apos;t.
                </p>
              </div>
              <div className="step">
                <span className="dot" />
                <h4>The demo dashboard</h4>
                <p>
                  I built a high-fidelity, fully synthetic demo of what an AI-era operating layer could look
                  like for them — group view down to departments, plants, procurement, sales, logistics — with
                  AI agents wired into every page. Deliberately more extensive than a workshop needs, because
                  the value of an AI-era dashboard isn&apos;t in any one page. It&apos;s in the connections
                  between them.
                </p>
              </div>

              <p className="grp">Day one</p>
              <div className="step">
                <span className="dot" />
                <h4>Leadership session — the frame</h4>
                <p>
                  A morning on what AI actually is (a reasoning ability, not a software category), then a
                  walkthrough of the demo end-to-end with the senior team reacting to specific views and
                  specific agent actions. Concerns collected, source-of-truth documents on the table.
                </p>
              </div>

              <p className="grp">Day two</p>
              <div className="step">
                <span className="dot" />
                <h4>Department deep-dives</h4>
                <p>
                  Three-hour working sessions with individual departments — problem-finding first, then
                  building. Each session ends with a named output: a list the team leaves with, not a deck they
                  file away. The demo dashboard becomes the baseline to improve, edit, and argue with.
                </p>
              </div>
              <div className="step">
                <span className="dot" />
                <h4>The handover</h4>
                <p>
                  Everything they need to carry it forward without me: the session materials, the write-ups,
                  the build prompts to replicate the demo, and honest notes on what a production version would
                  take. A good engagement should end with the client more capable, not more dependent.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* THE THINKING TOOL */}
        <section className="sec">
          <div className="wrap">
            <p className="kicker">§ 02 · The demo</p>
            <h2>
              A dashboard as a <em>thinking tool</em>
            </h2>
            <div className="prose">
              <p>
                The demo ran on one adoption idea: <b>every senior leader has one daily headache the dashboard
                solves</b> — that solution is why they actually open it. Underneath, every page feeds a shared
                intelligence layer, and AI agents act inside that context: drafting interventions, creating
                tasks, flagging anomalies that cross silos. The move I wanted the team to feel is the dashboard
                going from <b>report to operator</b>.
              </p>
              <p>
                And an honest disclaimer I kept repeating, because it&apos;s the point: the demo doesn&apos;t
                touch their real systems and every number in it is synthesised — accurate in shape, not in
                reality. It&apos;s a thinking tool. A way to compress a year of &ldquo;what if we had X?&rdquo;
                into something a leadership team can click through together in a workshop room, and react to
                concretely.
              </p>
            </div>

            <div className="mock">
              <div className="mock-bar">
                <i />
                <i />
                <i />
                <span className="t">demo · morning command centre</span>
              </div>
              <div className="mock-body">
                <p className="mk-kick">Today · exception-first</p>
                <h5>The morning brief</h5>
                <div className="mk-kpis">
                  <div className="mk-kpi">
                    <b>On track</b>
                    <span>Sales vs plan</span>
                    <div className="bar" style={{ width: '78%' }} />
                  </div>
                  <div className="mk-kpi warn">
                    <b>2 flags</b>
                    <span>Anomalies · cross-silo</span>
                    <div className="bar" style={{ width: '34%', background: '#a52f2f' }} />
                  </div>
                  <div className="mk-kpi">
                    <b>5 tasks</b>
                    <span>Routed to owners</span>
                    <div className="bar" style={{ width: '60%' }} />
                  </div>
                </div>
                <div className="mk-note">
                  <span className="who">✦ Agent · this morning</span>
                  <b>One thing worth a phone call today:</b> a long-standing account is quietly shrinking —
                  flagged with its likely cause, the rupee impact, and the owner who should ring them.
                  (Synthetic data, real behaviour.)
                </div>
              </div>
            </div>
            <p className="cap">
              Recreated in CSS, numbers invented — the shape of the thing, which is exactly what a thinking
              tool should be.
            </p>
          </div>
        </section>

        {/* THE REFRAME */}
        <div className="band">
          <div className="band-inner">
            <p className="kicker">§ 03 · The night before</p>
            <h2>The dashboard was never the point</h2>
            <div className="prose">
              <p>
                Here&apos;s the part I&apos;ll remember longest. The company is so rich and multi-faceted that
                I spent weeks happily engrossed in the game of fitting it all into a dashboard — and the team
                played along with me. The night before the first session I had to physically snap out of it and
                say: <b>no. The dashboard is one output. It is not the purpose.</b>
              </p>
              <p>
                The purpose was to rethink the company in the context of AI — to ask what it means to run a
                three-decade-old business when reasoning itself has become cheap. The framing that anchored the
                whole workshop:
              </p>
            </div>
            <p className="bigquote">
              &ldquo;AI doesn&apos;t augment your company. <span>It reveals what your company actually is.</span>&rdquo;
            </p>
            <div className="prose">
              <p>
                For this company, what it reveals is lovely: their edge was never just the product — it was
                understanding one person, the farmer, better than anyone else, and solving for what they
                needed. The AI-era question is simply that same edge, at scale: the same depth of
                understanding, extended to every farmer, every customer, every exec on the ground — heard in
                their own words, in their own language. What we don&apos;t measure, we can&apos;t improve. So
                each working session ended by naming what to start measuring, and who&apos;s slipping away
                while we chase the new.
              </p>
            </div>
            <div className="band-foot">
              <span>from the workshop decks</span>
              <span>hyderabad · 2026</span>
            </div>
          </div>
        </div>

        {/* LEARNINGS */}
        <section className="sec">
          <div className="wrap">
            <p className="kicker">§ 04 · Field notes</p>
            <h2>
              What I learned about <em>rooms</em>
            </h2>
            <p className="sec-intro">
              The technical build matters, but engagements are won or lost in the room. These are the notes
              I&apos;m carrying into every future workshop.
            </p>

            <div className="princ">
              {PRINCIPLES.map(c => (
                <div className="pcard" key={c.pn}>
                  <span className="pn">{c.pn}</span>
                  <h4>{c.h}</h4>
                  <p>{c.p}</p>
                  <p className="map">
                    <b>Here:</b> {c.map}
                  </p>
                </div>
              ))}
            </div>

            <div className="aside-box">
              <span className="kicker">Meanwhile, in milk · పాల యాత్ర</span>
              <ul className="facts">
                {FACTS.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* WHAT ADVISORY MEANS */}
        <section className="sec">
          <div className="wrap">
            <p className="kicker">§ 05 · What I&apos;m selling, apparently</p>
            <h2>
              It was never <em>just</em> AI
            </h2>
            <div className="prose">
              <p>
                A framing from the company&apos;s leadership that I&apos;ve adopted wholesale: they didn&apos;t
                bring me in for AI knowledge alone. They brought in the whole stack — years inside a family
                agri-business, building and running Hoovu, Stanford, the operator&apos;s instinct for what a
                morning actually looks like in a business that moves physical goods. AI is one piece of that
                puzzle — the newest one.
              </p>
              <p>The honest priority order of what an engagement like this delivers:</p>
            </div>
            <div className="ladder">
              <div className="rung">
                <span className="r">1</span>
                <span className="rt">A shared frame</span>
                <span className="rd">
                  the leadership thinking about AI as reasoning, together, in the same vocabulary.
                </span>
              </div>
              <div className="rung">
                <span className="r">2</span>
                <span className="rt">Named blind spots</span>
                <span className="rd">
                  each department leaves knowing what it doesn&apos;t measure — and what to build next.
                </span>
              </div>
              <div className="rung">
                <span className="r">3</span>
                <span className="rt">The artifact</span>
                <span className="rd">the demo dashboard — vivid, clickable, and deliberately disposable.</span>
              </div>
            </div>
          </div>
        </section>

        {/* CLOSE */}
        <section className="sec closing">
          <div className="wrap">
            <p className="kicker">§ 06 · With thanks</p>
            <h2>Grateful, mostly</h2>
            <div className="prose">
              <p>
                Dodla Dairy is among the top listed companies in the country by revenue, thirty years old, built
                on a genuinely beautiful founding insight about trust and the farmer. A company like that has
                every excuse to move slowly and every right to be sceptical of a consultant with a laptop full
                of ideas. Instead, they were the warmest, fastest room I&apos;ve worked: leadership who sat
                through every session, department heads who chose the longer version, and a team that argued
                with the demo in exactly the way you hope people will argue with a thinking tool.
              </p>
              <p>
                I left with a camera roll of milk-glass toasts, a notebook of things I&apos;d do better, and the
                strong suspicion that this — sitting with real operators, rethinking real companies — is the
                most fun version of working in AI right now.
              </p>
            </div>

            <blockquote>
              &ldquo;The dashboard is an output. <span>The reframe is the product.&rdquo;</span>
            </blockquote>

            <div className="badges">
              <span className="badge">ai advisory</span>
              <span className="badge">2-day leadership workshop</span>
              <span className="badge">demo intelligence dashboard</span>
              <span className="badge">agents · report → operator</span>
              <span className="badge">built with claude code</span>
            </div>

            <p className="tiernote">
              This is the shape of the <Link href="/workshops#pricing">₹5,00,000 session tier</Link> — a
              customised day with a demo dashboard built for the company beforehand.
            </p>
          </div>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
