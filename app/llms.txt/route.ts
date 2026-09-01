import { TIERS, FINE_PRINT, MODULE_COUNT } from '@/lib/site/workshops';
import { allPosts } from '@/lib/writing/posts';

export const dynamic = 'force-dynamic';

const SITE = 'https://heyrhai.com';

// llms.txt — the emerging convention (llmstxt.org) for giving AI agents and
// answer engines a clean, curated map of a site in plain markdown, instead of
// making them infer it from rendered HTML. Generated from the same sources the
// pages render, so it can never drift from what's actually on the site.
export async function GET() {
  const posts = allPosts();
  const body = `# Rhai

> An AI practice by Rhea Karuturi. We do two things for Indian companies: teach your team to build with AI on your own systems in a day, and build the intelligence dashboards those teams then run the business on. You own everything from minute one — no vendor, no lock-in.

Based in Bangalore and San Francisco. Every engagement runs through Rhea Karuturi directly — co-founder and CTO of Hoovu Fresh (a B2B puja-flower supply chain across nine Indian cities), Stanford B.S. in Science, Technology & Society. Since March 2026: 100+ people trained across 12 companies in real estate, aerospace, manufacturing, F&B, healthcare and fintech.

## What we sell

${TIERS.map(t => `- **${t.name} — ${t.price}** (${t.shape}). ${t.blurb}`).join('\n')}
- **Commissioned intelligence dashboards.** The intelligence layer leadership runs the business on — reads everything you have, briefs every leader each morning, notices problems before they escalate, and drafts the response. Not BI: five stages — capture, view, analyse, insight, action — and most dashboards stop at stage three.

Every session is assembled from a library of ${MODULE_COUNT} tested modules; nothing is written for the first time in your room.

## Terms

${FINE_PRINT.map(f => `- **${f.label}.** ${f.body}`).join('\n')}

## Key pages

- [Workshops, formats and pricing](${SITE}/workshops): the three formats, what a session involves, and the commercial terms.
- [The module library](${SITE}/workshops/modules): all ${MODULE_COUNT} modules every session is built from.
- [Hang w AI](${SITE}/hang-w-ai): the free weekly in-person community in Bangalore and Hyderabad (~350 members) — our top of funnel and trust engine.
- [Writing](${SITE}/writing): case studies and build logs.
- [Careers](${SITE}/careers): open roles.

## Case studies

${posts
  .slice(0, 6)
  .map(p => `- [${p.title}](${SITE}/writing/${p.slug}): ${p.dek}`)
  .join('\n')}

## Contact

Email rhea@heyrhai.com to start a conversation about a workshop or a build.
`;
  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' }
  });
}
