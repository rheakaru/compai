// The Hester Biosciences engagement — "How to make twenty champions" — in its
// own design language, matching the standalone HTML write-up rather than the
// site's editorial-prose template. Dark hero, the champion-stall loop, the
// numbered principles, the name-card and persona-page mocks, the blank-vs-draft
// tone compare, the checklist.
//
// Every selector is scoped under `.hester`, because the source styled `body`,
// `h1`, `blockquote`, `section` etc. globally and unscoped that would leak into
// the shared SiteHeader/SiteFooter and every other page in this bundle.
//
// Fonts are the vendored files in public/fonts (see DodlaCaseStudy for the
// rationale — next/font would make the build fetch from Google). This design
// adds Fraunces 900; italics are faux-slanted from the normal faces, exactly as
// the source did.

import Link from 'next/link';
import { SiteFooter, SiteHeader } from './SiteChrome';

const FONT_FACES = `
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
@font-face {
  font-family: 'Fraunces';
  font-style: normal;
  font-weight: 900;
  font-display: swap;
  src: url(/fonts/fraunces-normal-900-latin-ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'Fraunces';
  font-style: normal;
  font-weight: 900;
  font-display: swap;
  src: url(/fonts/fraunces-normal-900-latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}`;

const CSS = `
.hester{
  --cream:#f6f2ea; --cream-100:#efe9dc; --paper:#FBFAF4;
  --ink:#1a1a17; --muted:#726a5d; --line:#e2dccf;
  --accent:#c64a1f; --accent-deep:#a73d18; --accent-tint:#fbe1d3;
  --h-serif:'Fraunces', Georgia, serif;
  --h-sans:'Inter Tight', system-ui, -apple-system, sans-serif;
  --h-mono:'JetBrains Mono', ui-monospace, Menlo, monospace;
  background-color:var(--cream);
  background-image:linear-gradient(rgba(26,26,23,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(26,26,23,0.045) 1px,transparent 1px);
  background-size:28px 28px; color:var(--ink);
  font-family:var(--h-sans); font-size:17px; line-height:1.65; -webkit-font-smoothing:antialiased;
}
.hester *{box-sizing:border-box}
.hester .wrap{max-width:1060px;margin:0 auto;padding:0 26px}
.hester h1,.hester h2,.hester h3,.hester h4,.hester h5{font-family:var(--h-serif);color:var(--ink);line-height:1.13;margin:0}
.hester a{color:var(--accent-deep)}
.hester .kicker{text-transform:uppercase;letter-spacing:0.18em;font-size:0.72rem;font-weight:700;color:var(--accent);margin-bottom:12px}

.hester .mark{display:inline-flex;align-items:center;gap:11px;font-family:var(--h-serif);font-size:1.6rem;font-weight:600;color:var(--ink)}
.hester .mark i{width:15px;height:15px;border-radius:50%;background:var(--accent);display:inline-block}
.hester .hero .mark{color:#fff} .hester .hero .mark i{background:var(--accent)}

.hester .hero{position:relative;overflow:hidden;background:linear-gradient(155deg,#17160f 0%,#241f16 52%,#33261a 100%);color:#efe9dc;border-bottom:3px solid var(--accent)}
.hester .hero .glow{position:absolute;inset:0;z-index:1;background:radial-gradient(640px 300px at 84% -8%,rgba(198,74,31,0.38),transparent 62%),radial-gradient(620px 320px at -5% 120%,rgba(254,189,17,0.14),transparent 58%)}
.hester .hero-inner{padding:64px 26px 60px;position:relative;z-index:2;max-width:1060px;margin:0 auto}
.hester .brandrow{display:flex;align-items:center;gap:16px;margin-bottom:38px;flex-wrap:wrap}
.hester .brandrow .b-sub{font-size:0.82rem;color:#c9beac;border-left:2px solid rgba(255,255,255,0.2);padding-left:16px}
.hester .brandrow .backlink{margin-left:auto;font-family:var(--h-mono);font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;color:#c9beac;text-decoration:none}
.hester .brandrow .backlink:hover{color:#f0a36f}
.hester .hero h1{font-size:clamp(2.3rem,5.8vw,4.1rem);font-weight:900;letter-spacing:-0.015em;color:#fff}
.hester .hero h1 em{font-style:italic;color:#f0a36f}
.hester .hero .lede{font-size:clamp(1.05rem,2.4vw,1.32rem);max-width:730px;margin:22px 0 0;color:#ded3c2}
.hester .hero .by{margin-top:26px;font-size:0.9rem;color:#b8ab98} .hester .hero .by b{color:#fff}
.hester .hero .kicker{color:#f0a36f}
.hester .ingredients{display:flex;flex-wrap:wrap;gap:10px;margin-top:34px}
.hester .ing{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.16);border-radius:30px;padding:8px 16px;font-size:0.85rem;color:#ede9e0}
.hester .ing b{color:#f0a36f}

.hester section{padding:70px 0;border-bottom:1px dashed var(--line)}
.hester section.tight{padding:54px 0}
.hester .sec-head{max-width:760px;margin-bottom:40px}
.hester .sec-head h2{font-size:clamp(1.8rem,4vw,2.7rem);font-weight:700}
.hester .sec-head p{color:var(--ink);font-size:1.05rem;margin:16px 0 0}
.hester .act-head{text-align:center;max-width:760px;margin:0 auto 46px}
.hester .act-label{display:inline-block;font-family:var(--h-mono);font-size:0.78rem;color:var(--accent-deep);border:1px solid var(--accent-tint);background:var(--accent-tint);padding:4px 14px;border-radius:20px;margin-bottom:16px}
.hester .act-head h2{font-size:clamp(1.9rem,4.2vw,2.8rem);font-weight:700}
.hester .act-head p{color:var(--muted);font-size:1.08rem;margin:16px 0 0}
.hester .prose p{color:var(--ink)}
.hester .prose p + p{margin-top:16px}

.hester .loop{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:8px}
@media(max-width:820px){.hester .loop{grid-template-columns:1fr 1fr}}
.hester .loop-node{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:16px 12px;text-align:center}
.hester .loop-node .ic{font-size:1.7rem}
.hester .loop-node h4{font-size:1rem;margin:8px 0 4px}
.hester .loop-node p{font-size:0.76rem;color:var(--muted);margin:0;line-height:1.4}
.hester .loop-node.lead{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-tint)}
.hester .loop-note{text-align:center;font-size:0.82rem;color:var(--muted);margin-top:14px;font-style:italic}

.hester .principle{display:grid;grid-template-columns:64px 1fr;gap:22px;margin-bottom:48px;align-items:start}
@media(max-width:680px){.hester .principle{grid-template-columns:1fr;gap:10px}}
.hester .pnum{font-family:var(--h-serif);font-weight:900;font-size:2.2rem;color:var(--accent);opacity:0.6;line-height:1;border-right:2px solid var(--line);padding-right:18px}
@media(max-width:680px){.hester .pnum{border-right:none;padding-right:0;font-size:1.6rem}}
.hester .principle h3{font-size:1.5rem;font-weight:700;margin-bottom:10px}
.hester .principle .ptag{font-size:0.72rem;text-transform:uppercase;letter-spacing:0.09em;font-weight:700;color:var(--accent-deep);margin-bottom:6px}
.hester .principle p{color:var(--ink);margin:0 0 14px}
.hester .principle ul{margin:0 0 14px;padding-left:0;list-style:none}
.hester .principle li{position:relative;padding-left:24px;margin-bottom:9px;color:var(--ink);font-size:0.97rem}
.hester .principle li::before{content:"→";position:absolute;left:0;color:var(--accent);font-weight:700}
.hester .takeaway{background:var(--accent-tint);border-left:4px solid var(--accent);border-radius:0 10px 10px 0;padding:12px 16px;font-size:0.92rem;color:var(--accent-deep)}
.hester .takeaway b{color:var(--accent-deep)}

.hester .mock{border-radius:16px;overflow:hidden;border:1px solid var(--line);box-shadow:0 18px 44px -22px rgba(26,26,23,0.4);background:var(--paper);margin:26px 0}
.hester .mock-bar{background:var(--ink);padding:9px 14px;display:flex;align-items:center;gap:7px}
.hester .mock-bar i{width:11px;height:11px;border-radius:50%;display:inline-block}
.hester .mock-bar .t{margin-left:10px;color:#c9c7c0;font-size:0.74rem;font-family:var(--h-mono)}
.hester .mock-body{padding:18px}
.hester .cap{font-size:0.82rem;color:var(--muted);font-style:italic;margin:-10px 0 26px;text-align:center}

.hester .namegrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:10px}
.hester .namecard{background:var(--cream);border:1px solid var(--line);border-radius:11px;padding:13px 14px}
.hester .namecard .nm{font-family:var(--h-serif);font-weight:600;font-size:0.98rem;color:var(--ink)}
.hester .namecard .rl{font-size:0.72rem;color:var(--accent-deep);font-weight:600;margin-top:2px}
.hester .namecard .ln{font-size:0.68rem;color:var(--muted);margin-top:7px;line-height:1.35}

.hester .pmock{display:grid;grid-template-columns:1.55fr 1fr;gap:12px}
@media(max-width:760px){.hester .pmock{grid-template-columns:1fr}}
.hester .panel{background:var(--cream);border:1px solid var(--line);border-radius:11px;padding:13px}
.hester .panel h5{font-size:0.9rem;margin-bottom:9px}
.hester .chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:11px}
.hester .chip{font-size:0.63rem;background:#fff;border:1px solid var(--line);border-radius:20px;padding:3px 9px;color:var(--muted)}
.hester .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:7px;margin-bottom:11px}
.hester .kpi{background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px 9px}
.hester .kpi .v{font-family:var(--h-serif);font-weight:700;font-size:1.02rem;color:var(--ink);line-height:1}
.hester .kpi .l{font-size:0.6rem;color:var(--muted);margin-top:3px}
.hester .kpi.warn{background:#fff8ee;border-color:#f0cfa8}
.hester .kpi.bad{background:#fdeeea;border-color:#f1c0b0}
.hester .bars{display:flex;align-items:flex-end;gap:7px;height:64px;padding:0 2px}
.hester .bars .b{flex:1;border-radius:3px 3px 0 0;background:var(--accent);opacity:0.85}
.hester .bars .b.alt{background:#a9a093;opacity:0.65}
.hester .chatline{display:flex;gap:7px;margin-bottom:7px}
.hester .bub{font-size:0.7rem;padding:7px 10px;border-radius:10px;max-width:88%;line-height:1.45}
.hester .bub.u{background:var(--accent);color:#fff;margin-left:auto;border-bottom-right-radius:3px}
.hester .bub.a{background:#fff;border:1px solid var(--line);color:var(--ink);border-bottom-left-radius:3px}
.hester .applied{font-size:0.63rem;color:#1c7a53;margin-top:3px}
.hester .newsec{border:2px dashed var(--accent);background:#fff;border-radius:9px;padding:10px 11px;margin-top:9px}
.hester .newsec .nt{font-size:0.63rem;color:var(--accent-deep);font-weight:700;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:5px}
.hester .newsec table{width:100%;border-collapse:collapse;font-size:0.64rem}
.hester .newsec th{text-align:left;color:var(--muted);font-weight:600;border-bottom:1px solid var(--line);padding:3px 4px;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.05em}
.hester .newsec td{padding:3px 4px;color:var(--ink);border-bottom:1px solid #f0ece2}

.hester .tone{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:680px){.hester .tone{grid-template-columns:1fr}}
.hester .tone-card{border-radius:13px;padding:20px;border:1px solid var(--line)}
.hester .tone-card.f{background:#fdf3ec;border-color:#f0cfb6}
.hester .tone-card.t{background:#f1f6ef;border-color:#c8dcbd}
.hester .tone-card h5{font-size:1.05rem;margin-bottom:10px}
.hester .tone-card .q{font-family:var(--h-serif);font-style:italic;font-size:0.96rem;color:var(--ink);margin:10px 0;padding-left:12px;border-left:3px solid var(--accent)}
.hester .tone-card.t .q{border-color:#5f9152}
.hester .tone-card small{color:var(--muted)}

.hester .check{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:680px){.hester .check{grid-template-columns:1fr}}
.hester .ci{display:flex;gap:10px;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.hester .ci .bx{color:var(--accent);font-weight:700;flex-shrink:0}
.hester .ci span{font-size:0.9rem;color:var(--ink)}

.hester blockquote{margin:0;padding:22px 28px;border-left:4px solid var(--accent);background:var(--accent-tint);border-radius:0 12px 12px 0;font-family:var(--h-serif);font-size:1.2rem;font-style:italic;color:var(--accent-deep)}
.hester .badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.hester .badge{font-size:0.74rem;font-family:var(--h-mono);background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:4px 12px;color:var(--ink)}
.hester .tiernote{margin-top:26px;font-size:0.95rem;color:var(--muted)}
.hester .tiernote a{color:var(--accent-deep);text-decoration:none;border-bottom:1px solid rgba(167,61,24,0.35)}
.hester .tiernote a:hover{border-bottom-color:var(--accent-deep)}
.hester .foot-cta{padding:44px 0 20px;text-align:center}
.hester .foot-cta .mark{justify-content:center}
`;

const LOOP = [
  ['✦', 'One champion', 'Leadership buys in, sponsors the tool'],
  ['↓', 'Rollout', 'Demo, training, logins issued'],
  ['⏳', 'Attention moves', 'The sponsor gets a new priority'],
  ['↘', 'Drift', 'Nobody owns the gap between tool and work'],
  ['■', 'Stall', 'The tool is alive in the licence, dead in the day']
];

// Name corrected: Junaid → Juned.
const NAMECARDS = [
  ['Hemal Shah', 'Procurement', 'Raw / packing / consumables / services, from the GL — item-wise, not just GL code'],
  ['Juned', 'Manufacturing', 'Process vs plan, RM & PM ready for each batch, predictive maintenance'],
  ['Palak Shah', 'HR, Admin & Legal', 'Attendance, recruitment follow-through, payroll compliance, AI screening'],
  ['Upendra', 'Distribution & Logistics', 'Order execution, CFA-wise stock, transport spend descending'],
  ['Gagan Das', 'Sales Admin', 'Data checks on the ERP dump, budget vs sales, the WHY behind non-reporting'],
  ['Dr Muley', 'Field Force Effectiveness', 'Weekly billing pattern — marathon, not sprint']
];

const CHECKLIST = [
  ['Find out whether the constraint is ', 'motivation or deployment', ' before you design the day'],
  ['Say the goal out loud early: ', 'everyone here leaves a champion', ''],
  ['Build one division deeply as the ', 'worked example', ', not a broad tour'],
  ['Turn the morning’s feedback into ', 'a page per person', ' over lunch'],
  ['Print their ', 'verbatim words', ' on their page so they see themselves'],
  ['Make the page ', 'editable by conversation', ', and let them watch it change'],
  ['Accept documents in their ', 'existing format', ' — parse, don’t request'],
  ['', 'Log every word', '; hand back the export as the spec']
];

const BADGES = ['Next.js', 'Claude', 'Firestore', 'Recharts', 'SheetJS', 'live page-spec editing', 'append-only feedback log'];

export function HesterCaseStudy() {
  return (
    <main className="min-h-screen bg-cream text-ink-900">
      <style dangerouslySetInnerHTML={{ __html: FONT_FACES + CSS }} />
      <SiteHeader />

      <div className="hester">
        <header className="hero">
          <div className="glow" />
          <div className="hero-inner">
            <div className="brandrow">
              <span className="mark">
                <i />
                Rhai
              </span>
              <span className="b-sub">Field notes · AI that people actually use</span>
              <Link href="/writing" className="backlink">
                ← All writing
              </Link>
            </div>
            <div className="kicker">Hester Biosciences · 25 August 2026</div>
            <h1>
              How do you make <em>twenty</em> champions?
            </h1>
            <p className="lede">
              A 40-year-old animal health company with a ₹2,000 crore valuation didn&apos;t have an AI motivation
              problem. Their leadership was already excited, already buying tools. They had a deployment problem — and
              the fix wasn&apos;t a better demo. It was giving twenty people a page that was already about their own
              job, and letting them argue with it.
            </p>
            <p className="by">
              By <b>Rhea Karuturi</b> · a day in Ahmedabad with the Hester team
            </p>
            <div className="ingredients">
              <span className="ing"><b>20+</b> leaders in the room</span>
              <span className="ing"><b>21</b> pages built from their own words</span>
              <span className="ing"><b>1</b> division as the worked example</span>
              <span className="ing"><b>0</b> blank pages</span>
            </div>
          </div>
        </header>

        <section>
          <div className="wrap prose">
            <div className="sec-head">
              <div className="kicker">The setup</div>
              <h2>The problem was never enthusiasm</h2>
              <p>
                Hester Biosciences makes animal vaccines and health products out of Mehsana, Gujarat. Forty years old,
                listed, roughly ₹2,000 crore. I went in expecting the usual adoption story — a sceptical old-economy
                company that needs convincing about AI.
              </p>
            </div>
            <p>
              That&apos;s not what I found. Priya, who runs the business, was already sold. The leadership team had
              already brought several technology solutions into the company. On our first call it was obvious that the
              will was there, and had been for a while.
            </p>
            <p>
              What they had instead was subtler and much more common: <strong>a start-stop problem.</strong> Tools
              arrive with real momentum at the top, then hit the floor and stall. Not because anyone objects — because
              nobody in the middle ever became responsible for making them work.
            </p>
            <p>
              That reframes the job entirely. If the constraint were motivation, you&apos;d build a better pitch. The
              constraint is <em>ownership distribution</em>, so you have to build something else: more owners.
            </p>
          </div>
        </section>

        <section>
          <div className="wrap">
            <div className="sec-head">
              <div className="kicker">The mental model</div>
              <h2>One champion is a single point of failure</h2>
              <p>
                Every stalled tool I&apos;ve seen has the same shape. Someone senior loves it. That person gets busy.
                Nothing about the tool survives their attention moving elsewhere, because nobody else ever had a stake
                in it.
              </p>
            </div>
            <div className="loop">
              {LOOP.map(([ic, h, p], i) => (
                <div key={h} className={`loop-node${i === LOOP.length - 1 ? ' lead' : ''}`}>
                  <div className="ic">{ic}</div>
                  <h4>{h}</h4>
                  <p>{p}</p>
                </div>
              ))}
            </div>
            <p className="loop-note">The failure isn&apos;t at the start. It&apos;s four steps later, and it&apos;s quiet.</p>
          </div>
        </section>

        <section>
          <div className="wrap">
            <div className="act-head">
              <span className="act-label">Act I</span>
              <h2>Stop demoing at people</h2>
              <p>
                The morning was a working dashboard for their Pet Care division — real formats, real numbers, an agent
                that reads the page. It was genuinely good. It was also the least important thing that happened all day.
              </p>
            </div>

            <div className="principle">
              <div className="pnum">01</div>
              <div>
                <div className="ptag">The trap</div>
                <h3>A great demo makes spectators, not owners</h3>
                <p>
                  We built the Pet Care division as a live operating layer: a WhatsApp-style field app where reps get
                  their tour plan, check in against a geofence, record a doctor meeting and leave a voice note — which
                  lands in the dashboard as an order draft, competitor intel and a geographic view of what&apos;s moving.
                </p>
                <p>
                  People liked it. They said so. And that reaction is exactly the danger: <strong>liking a demo costs
                  nothing.</strong> Nobody in the room had anything at stake in it yet. They were an audience, and
                  audiences disperse.
                </p>
                <div className="takeaway">
                  <b>The test:</b> if your session ends with applause and no arguments, you built spectators.
                </div>
              </div>
            </div>

            <div className="principle">
              <div className="pnum">02</div>
              <div>
                <div className="ptag">The reframe</div>
                <h3>Make the room co-authors before you build the product</h3>
                <p>
                  So I said it out loud, early: today is not about this dashboard. Today is about going from Priya and
                  her leadership team being the champions for new technology, to every one of the twenty people in this
                  room walking out as a champion for whatever we build.
                </p>
                <p>
                  That reframing does something structural. It moves the room from evaluating my work to{' '}
                  <em>specifying theirs</em> — and it makes the rest of the day a working session rather than a pitch.
                </p>
                <ul>
                  <li>Ask what breaks in their week, not what they think of the product</li>
                  <li>Name the person, not the department — pages belong to humans</li>
                  <li>Treat every objection as a requirement you didn&apos;t have yet</li>
                </ul>
                <div className="takeaway">
                  <b>The shift:</b> a tool with one champion dies when that person gets busy. A tool with twenty gets
                  built into how the company runs.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <div className="act-head">
              <span className="act-label">Act II</span>
              <h2>The post-lunch page</h2>
              <p>
                Over lunch I took the feedback each person had given that morning about their own work, and turned it
                into twenty-one pages. After lunch, everyone clicked their own name.
              </p>
            </div>

            <div className="principle">
              <div className="pnum">03</div>
              <div>
                <div className="ptag">The core move</div>
                <h3>Kill the blank page</h3>
                <p>
                  The standard way to gather requirements is to ask: <em>what would you want your dashboard to show?</em>{' '}
                  It sounds respectful and collaborative. It almost never works.
                </p>
                <p>
                  Ask a procurement head that question cold and you get vague, safe answers — &ldquo;sales figures,
                  maybe some trends&rdquo; — because you&apos;ve handed them a blank page and asked them to be an
                  information architect on the spot. That&apos;s not their job, and it&apos;s genuinely hard.
                </p>
                <p>
                  So we inverted it. Every person got a page that was <strong>already a draft of their own job</strong>,
                  built from the words they&apos;d used that morning, with their verbatim asks printed as chips across
                  the top so they could see themselves in it.
                </p>
                <div className="takeaway">
                  <b>The principle:</b> people can&apos;t author from nothing, but everyone can correct something.
                  Editing is a far lower bar than inventing.
                </div>
              </div>
            </div>

            <div className="mock">
              <div className="mock-bar">
                <i style={{ background: '#ff5f57' }} />
                <i style={{ background: '#febc2e' }} />
                <i style={{ background: '#28c840' }} />
                <span className="t">hester · built for you</span>
              </div>
              <div className="mock-body">
                <div className="namegrid">
                  {NAMECARDS.map(([nm, rl, ln]) => (
                    <div className="namecard" key={nm}>
                      <div className="nm">{nm}</div>
                      <div className="rl">{rl}</div>
                      <div className="ln">{ln}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="cap">Twenty-one names. Everyone finds themselves in the first five seconds.</p>

            <div className="principle">
              <div className="pnum">04</div>
              <div>
                <div className="ptag">The mechanism</div>
                <h3>Let them edit the page by talking to it</h3>
                <p>
                  Each page has a chat beside it, and the chat doesn&apos;t just answer — it{' '}
                  <strong>rewrites the page</strong>. Tell it the first chart isn&apos;t what you need, or that a
                  section is missing, and the agent changes the layout live: adds a section, drops one, reorders,
                  replaces the KPIs. The changed block highlights and scrolls into view.
                </p>
                <p>
                  Underneath, the page is a spec — an ordered list of sections as data, not code — and the agent emits
                  edit operations against it. That&apos;s the whole trick. It means feedback isn&apos;t collected for
                  later; it&apos;s applied in front of the person who gave it.
                </p>
                <ul>
                  <li>Watching the page change is what converts &ldquo;sounds nice&rdquo; into &ldquo;this is mine&rdquo;</li>
                  <li>The correction is more precise than any answer to an open question</li>
                  <li>Reset is always one click away, so nobody is afraid to break it</li>
                </ul>
                <div className="takeaway">
                  <b>Why it lands:</b> the moment a person&apos;s own sentence visibly reshapes the product, they stop
                  being a reviewer and start being an author.
                </div>
              </div>
            </div>

            <div className="mock">
              <div className="mock-bar">
                <i style={{ background: '#ff5f57' }} />
                <i style={{ background: '#febc2e' }} />
                <i style={{ background: '#28c840' }} />
                <span className="t">hester · built for you / hemal shah</span>
              </div>
              <div className="mock-body">
                <div className="pmock">
                  <div className="panel">
                    <h5>Procurement — built from your feedback</h5>
                    <div className="chips">
                      <span className="chip">&ldquo;raw, packing, consumables — and services&rdquo;</span>
                      <span className="chip">&ldquo;item-wise, not just the GL code&rdquo;</span>
                      <span className="chip">&ldquo;asset till it goes into expenses&rdquo;</span>
                    </div>
                    <div className="kpis">
                      <div className="kpi"><div className="v">₹1.86 Cr</div><div className="l">Budget MTD</div></div>
                      <div className="kpi"><div className="v">₹4.9 Cr</div><div className="l">Sitting as asset</div></div>
                      <div className="kpi warn"><div className="v">₹1.38 Cr</div><div className="l">Consumed</div></div>
                      <div className="kpi bad"><div className="v">6</div><div className="l">POs to prep now</div></div>
                    </div>
                    <div className="bars">
                      <div className="b" style={{ height: '78%' }} />
                      <div className="b alt" style={{ height: '66%' }} />
                      <div className="b" style={{ height: '52%' }} />
                      <div className="b alt" style={{ height: '46%' }} />
                      <div className="b" style={{ height: '40%' }} />
                      <div className="b alt" style={{ height: '22%' }} />
                    </div>
                    <div className="newsec">
                      <div className="nt">✦ just added from your feedback</div>
                      <table>
                        <tbody>
                          <tr>
                            <th>PO #</th>
                            <th>With</th>
                            <th>Days</th>
                            <th>Status</th>
                          </tr>
                          <tr>
                            <td>PO-4471</td>
                            <td>Plant Head</td>
                            <td>11</td>
                            <td>Awaiting 2nd quote</td>
                          </tr>
                          <tr>
                            <td>PO-4483</td>
                            <td>Finance</td>
                            <td>9</td>
                            <td>Budget code query</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="panel">
                    <h5>Shape this page</h5>
                    <div className="chatline">
                      <div className="bub u">Add a section I&apos;m missing</div>
                    </div>
                    <div className="chatline">
                      <div className="bub a">
                        You can see what&apos;s pending and who to compare vendors against — but nothing shows where POs
                        are stuck in approval. I&apos;ve added a PO approval pipeline showing each pending PO, who&apos;s
                        holding it, and how long it&apos;s been stuck.
                        <div className="applied">✓ 1 change applied to the page</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="cap">The agent spotted the gap itself — and the page changed while its owner watched.</p>

            <div className="principle">
              <div className="pnum">05</div>
              <div>
                <div className="ptag">The evidence</div>
                <h3>Take their documents in the format they already have</h3>
                <p>
                  The second half of the blank-page problem is the data question: <em>send me your files and we&apos;ll
                  see what we can do.</em> That stalls for weeks, because it asks people to prepare something.
                </p>
                <p>
                  Instead, each page takes uploads in whatever shape the work already lives — the monthly expense
                  statement, the distributor stock Excel, a scanned register, an MS Project plan. The spreadsheet parses
                  in the browser and their real columns appear on the page immediately, and the agent then rewires the
                  surrounding sections to say which are now fed by that file.
                </p>
                <ul>
                  <li>Their columns, unchanged — we build the parser around the format, not the reverse</li>
                  <li>What can&apos;t be opened in a browser says so honestly, and shows exactly which fields get extracted server-side</li>
                  <li>The proof is the point: your file, your rows, on your page, within seconds</li>
                </ul>
                <div className="takeaway">
                  <b>The rule:</b> never ask someone to reformat their work to fit your demo. The format <em>is</em> the
                  requirement.
                </div>
              </div>
            </div>

            <div className="principle">
              <div className="pnum">06</div>
              <div>
                <div className="ptag">The discipline</div>
                <h3>Capture it, or the day evaporates</h3>
                <p>
                  The first version of this had a real flaw: all that feedback lived in the browser session. Twenty
                  people spent an afternoon telling the product exactly what they needed, and it would have vanished on
                  refresh.
                </p>
                <p>
                  Now every message, every applied edit and every upload is appended to a log — append-only, so nothing
                  can be quietly edited away — and there&apos;s a review page grouped by person, exportable as a
                  document. That log <strong>is</strong> the requirements spec. It&apos;s written in their words,
                  timestamped, with the agent&apos;s response beside it.
                </p>
                <div className="takeaway">
                  <b>The takeaway:</b> a workshop that isn&apos;t captured is a nice day out. The artefact is the
                  deliverable.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <div className="sec-head">
              <div className="kicker">The shift, in two sentences</div>
              <h2>What changes when the page is already theirs</h2>
            </div>
            <div className="tone">
              <div className="tone-card f">
                <h5>Blank page</h5>
                <div className="q">&ldquo;So — what would you want your dashboard to show?&rdquo;</div>
                <small>
                  Answers are vague and safe. The person is being asked to design, which isn&apos;t their job. You leave
                  with a wish list nobody owns.
                </small>
              </div>
              <div className="tone-card t">
                <h5>Draft page</h5>
                <div className="q">&ldquo;Here&apos;s your job as a page. Tell me what&apos;s wrong with it.&rdquo;</div>
                <small>
                  Answers are specific and confident, because correcting is easy. You leave with a spec — and the person
                  who dictated it.
                </small>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <div className="sec-head">
              <div className="kicker">Putting it together</div>
              <h2>If you&apos;re running one of these</h2>
            </div>
            <div className="check">
              {CHECKLIST.map(([pre, bold, post], i) => (
                <div className="ci" key={i}>
                  <span className="bx">✓</span>
                  <span>
                    {pre}
                    <b>{bold}</b>
                    {post}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="tight">
          <div className="wrap prose">
            <blockquote>
              A tool with one champion dies the moment that person gets busy. A tool with twenty gets built into how the
              company actually works.
            </blockquote>
            <p style={{ marginTop: '26px' }}>
              The pages we made that afternoon are demos. Some of the numbers in them are synthetic and clearly labelled
              as such. None of that mattered as much as the thing that happened in the room: twenty people stopped
              watching a product and started correcting one.
            </p>
            <p>
              That&apos;s the whole method. Don&apos;t ask people to imagine what AI could do for their work. Show them a
              draft of their own week, get it slightly wrong on purpose, and let them fix it in front of you. They&apos;ll
              tell you more in ten minutes of arguing than in a month of requirement-gathering — and at the end of it,
              the thing has their fingerprints on it.
            </p>
            <div className="badges">
              {BADGES.map(b => (
                <span className="badge" key={b}>
                  {b}
                </span>
              ))}
            </div>
            <p className="tiernote">
              This is the shape of the <Link href="/workshops#pricing">₹5,00,000 session tier</Link> — a customised day
              with a demo dashboard built for the company beforehand.
            </p>
          </div>
        </section>

        <div className="foot-cta">
          <span className="mark">
            <i />
            Rhai
          </span>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
