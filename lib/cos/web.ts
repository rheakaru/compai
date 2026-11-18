import 'server-only';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { randomUUID } from 'crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, stripCitations } from '@/lib/rhai/server';
import { modelFor } from '@/lib/rhai/models';
import type { CosAgent, CosFact } from './types';

// The two "go look things up" jobs of the Chief of Staff builder:
//   1. researchPerson — a web search on the participant (name, LinkedIn URL,
//      company) that returns short facts they then confirm or reject. LinkedIn
//      itself sits behind a login wall, so we never fetch it directly; search
//      results (which index public LinkedIn headlines) are what we read.
//   2. readCompanySite — fetch the company website (home + a few about/product
//      pages) and compile a brief. Falls back to a web search when the site is
//      a JS shell with no readable text.
// Every server-side fetch of a user-supplied URL goes through safeFetch, which
// refuses private / link-local addresses (Cloud Run's metadata server lives at
// 169.254.169.254) and re-checks every redirect hop.

const WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search', max_uses: 5 } as unknown as Anthropic.Messages.Tool;

// ---------------------------------------------------------------------------
// Person research
// ---------------------------------------------------------------------------
export async function researchPerson(agent: CosAgent): Promise<CosFact[]> {
  const p = agent.profile;
  const c = agent.company;
  const emailDomain = /@([^@]+)$/.exec(agent.email)?.[1] ?? '';
  const genericMail = /^(gmail|googlemail|yahoo|outlook|hotmail|icloud|proton(mail)?|live)\./i.test(emailDomain);
  const hints = [
    `Name: ${p.name}`,
    p.links.length && `Their own links (LinkedIn etc.): ${p.links.join(', ')}`,
    (c.name || c.website) && `Company: ${[c.name, c.website].filter(Boolean).join(' — ')}`,
    emailDomain && !genericMail && `Work email domain: ${emailDomain}`,
    p.bio.trim() && `What they wrote about themselves: ${p.bio.trim().slice(0, 800)}`
  ]
    .filter(Boolean)
    .join('\n');

  const msg = await anthropic().messages.create({
    model: modelFor('cosIntake'),
    max_tokens: 2500,
    tools: [WEB_SEARCH_TOOL],
    system: [
      'You research a person for their new AI chief of staff. They will see every fact you return and tick yes or no, so precision matters more than volume.',
      'Search the web (LinkedIn profiles show up in search results — use their LinkedIn URL or "<name> <company> LinkedIn" as a query; also try their company, talks, articles, interviews, press).',
      'Only return facts you are confident are about THIS person, not a namesake. If the name is common and nothing ties a result to their company, links or email domain, leave it out.',
      'Each fact: one short sentence a chief of staff would find useful — current role and company, past roles, education, location, what they are known for, recent talks/articles/news, causes. Write it about them in the third person.',
      'Return 4–10 facts. If you genuinely find nothing reliable, return an empty list.',
      'Finish with ONLY this JSON (no fences, nothing after it): {"facts":[{"text":"…","source":"<url or site name>"}]}'
    ].join('\n'),
    messages: [{ role: 'user', content: `Find out about this person:\n${hints}` }]
  });
  const text = stripCitations(
    msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
  );
  const parsed = lastJson<{ facts?: { text?: string; source?: string }[] }>(text);
  return (parsed?.facts ?? [])
    .map(f => ({
      id: randomUUID().slice(0, 8),
      text: String(f.text ?? '').trim().slice(0, 400),
      source: String(f.source ?? '').trim().slice(0, 300),
      status: 'pending' as const
    }))
    .filter(f => f.text)
    .slice(0, 12);
}

// ---------------------------------------------------------------------------
// Company website
// ---------------------------------------------------------------------------
export async function readCompanySite(rawUrl: string, companyName: string): Promise<{ brief: string; name: string }> {
  const url = normalizeUrl(rawUrl);
  if (!url) throw new Error('That does not look like a website address.');

  const pages: string[] = [];
  const home = await safeFetch(url);
  if (home) {
    pages.push(`# ${url}\n${htmlToText(home.html).slice(0, 12_000)}`);
    for (const link of pickAboutLinks(home.html, home.finalUrl).slice(0, 3)) {
      const pg = await safeFetch(link);
      if (pg) pages.push(`# ${link}\n${htmlToText(pg.html).slice(0, 8_000)}`);
    }
  }
  const siteText = pages.join('\n\n').slice(0, 30_000);
  const readable = siteText.replace(/\s+/g, ' ').length > 600;

  const system = [
    'You write the company section of a chief of staff\'s briefing. Be factual and specific: what the company does, for whom, products/services, business model, scale signals (locations, team size, customers, funding) if stated, and anything notable. 120–220 words of plain prose, no headings, no marketing fluff, nothing invented.',
    'Finish with ONLY this JSON (no fences, nothing after it): {"name":"<company name>","brief":"<the brief>"}'
  ].join('\n');

  const msg = readable
    ? await anthropic().messages.create({
        model: modelFor('cosIntake'),
        max_tokens: 1200,
        system,
        messages: [{ role: 'user', content: `Company website text${companyName ? ` (company: ${companyName})` : ''}:\n\n${siteText}` }]
      })
    : await anthropic().messages.create({
        // JS-only site or the fetch was blocked — search instead.
        model: modelFor('cosIntake'),
        max_tokens: 2000,
        tools: [WEB_SEARCH_TOOL],
        system,
        messages: [{ role: 'user', content: `The website ${url}${companyName ? ` (${companyName})` : ''} could not be read directly. Search the web for this company and write the brief.` }]
      });
  const text = stripCitations(
    msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
  );
  const parsed = lastJson<{ name?: string; brief?: string }>(text);
  const brief = String(parsed?.brief ?? '').trim();
  if (!brief) throw new Error('Could not make sense of that website — add a few lines about the company instead.');
  return { brief: brief.slice(0, 4000), name: String(parsed?.name ?? '').trim().slice(0, 120) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function normalizeUrl(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    return mapped ? isPrivateIp(mapped[1]) : false;
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

async function hostIsPublic(hostname: string): Promise<boolean> {
  if (/^(localhost|metadata(\.google\.internal)?)$/i.test(hostname) || hostname.endsWith('.internal')) return false;
  try {
    const addrs = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true });
    return addrs.length > 0 && addrs.every(a => !isPrivateIp(a.address));
  } catch {
    return false;
  }
}

/** GET a public web page as text. null on any failure. Max 3 redirects, 8s, 2 MB. */
export async function safeFetch(url: string): Promise<{ html: string; finalUrl: string } | null> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    let u: URL;
    try {
      u = new URL(current);
    } catch {
      return null;
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!(await hostIsPublic(u.hostname))) return null;
    try {
      const res = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; RhaiChiefOfStaff/1.0; +https://heyrhai.com/chief-of-staff)',
          accept: 'text/html,application/xhtml+xml'
        }
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return null;
        current = new URL(loc, current).toString();
        continue;
      }
      if (!res.ok) return null;
      const type = res.headers.get('content-type') ?? '';
      if (!type.includes('html') && !type.includes('text')) return null;
      const buf = await res.arrayBuffer();
      return { html: Buffer.from(buf.slice(0, 2_000_000)).toString('utf8'), finalUrl: current };
    } catch {
      return null;
    }
  }
  return null;
}

export function htmlToText(html: string): string {
  const meta = [
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1],
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i.exec(html)?.[1],
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)/i.exec(html)?.[1]
  ]
    .filter(Boolean)
    .join('\n');
  const body = html
    .replace(/<(script|style|noscript|svg|iframe|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|section|article|li|h[1-6]|br|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
  return `${meta}\n${body}`.trim();
}

function pickAboutLinks(html: string, base: string): string[] {
  const out = new Set<string>();
  const baseHost = new URL(base).hostname.replace(/^www\./, '');
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)) {
    const href = m[1];
    if (!/(about|company|team|story|who-we-are|what-we-do|services|solutions|products?|platform)/i.test(href)) continue;
    try {
      const u = new URL(href, base);
      if (u.hostname.replace(/^www\./, '') !== baseHost) continue;
      u.hash = '';
      u.search = '';
      const s = u.toString();
      if (s !== base) out.add(s);
    } catch {
      // ignore bad hrefs
    }
  }
  return [...out];
}

/** The last {...} block in a model reply (web-search answers often have prose before it). */
export function lastJson<T>(text: string): T | null {
  const end = text.lastIndexOf('}');
  if (end === -1) return null;
  // Walk back to the matching opening brace.
  let depth = 0;
  for (let i = end; i >= 0; i--) {
    const ch = text[i];
    if (ch === '}') depth++;
    else if (ch === '{') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(i, end + 1)) as T;
        } catch {
          break;
        }
      }
    }
  }
  // Braces inside strings can throw the walk off — try the widest span.
  const start = text.indexOf('{');
  try {
    return start === -1 ? null : (JSON.parse(text.slice(start, end + 1)) as T);
  } catch {
    return null;
  }
}
