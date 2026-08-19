import 'server-only';
import fs from 'node:fs';
import path from 'node:path';

// The writing archive — project write-ups republished on heyrhai.com from
// Rhea's personal site. Each post is a markdown file in content/writing/ with
// a small frontmatter block; this module is the only thing that knows that.
//
// Files are read once per server process at first access. next.config.mjs
// traces content/writing/** into the deployment so the directory exists at
// runtime.

export interface WritingPost {
  slug: string;
  title: string;
  dek: string;
  tags: string[];
  /** Original URL on rheakaru.github.io — credited on the page. */
  source?: string;
  body: string;
  /** Rounded minutes, for the "6 min read" line. */
  readingMinutes: number;
}

// Curated ordering — the builds most relevant to what Rhai sells go first.
// Anything not listed sorts after these, alphabetically.
const FEATURED_ORDER = [
  'dodla-dairy',
  'hoovu-dashboard',
  'hoovu-ai-agents',
  'ai-cmo',
  'throughline',
  'vanaja',
  'comprice',
  'chapel',
  'thebrief',
  'cahoots',
  'vendetta',
  'sima'
];

const CONTENT_DIR = path.join(process.cwd(), 'content', 'writing');

/** Minimal frontmatter parser — `key: value` lines between --- fences. */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { meta: {}, body: raw.trim() };
  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    // Split on the FIRST colon only, so titles and deks may contain colons.
    let value = line.slice(idx + 1).trim();
    // Tolerate quoted values if a writer adds them.
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    if (key) meta[key] = value;
  }
  return { meta, body: raw.slice(match[0].length).trim() };
}

let cache: WritingPost[] | null = null;

export function allPosts(): WritingPost[] {
  if (cache) return cache;
  let files: string[] = [];
  try {
    files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  } catch {
    // No content directory (fresh checkout / trimmed deploy) — empty archive.
    return (cache = []);
  }

  const posts = files.map(file => {
    const slug = file.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    const words = body.split(/\s+/).filter(Boolean).length;
    return {
      slug,
      title: meta.title || slug,
      dek: meta.dek || '',
      tags: (meta.tags || '')
        .split(',')
        .map(t => t.trim())
        .filter(Boolean),
      source: meta.source || undefined,
      body,
      readingMinutes: Math.max(1, Math.round(words / 220))
    } satisfies WritingPost;
  });

  const rank = (slug: string) => {
    const i = FEATURED_ORDER.indexOf(slug);
    return i === -1 ? FEATURED_ORDER.length : i;
  };
  posts.sort((a, b) => rank(a.slug) - rank(b.slug) || a.title.localeCompare(b.title));

  return (cache = posts);
}

export function postBySlug(slug: string): WritingPost | undefined {
  return allPosts().find(p => p.slug === slug);
}
