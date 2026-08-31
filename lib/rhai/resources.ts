import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { renderMarkdown } from '@/lib/markdown';

// Team learning resources — markdown in content/resources/ with small
// frontmatter. Read once per server process. Traced into the deployment via
// next.config.mjs for the routes that render them.

export interface Resource {
  slug: string;
  title: string;
  dek: string;
  audience: string;
  order: number;
  body: string;
  readingMinutes: number;
}

const DIR = path.join(process.cwd(), 'content', 'resources');

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return { meta: {}, body: raw.trim() };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    meta[line.slice(0, i).trim()] = v;
  }
  return { meta, body: raw.slice(m[0].length).trim() };
}

let cache: Resource[] | null = null;

export function allResources(): Resource[] {
  if (cache) return cache;
  let files: string[] = [];
  try {
    files = fs.readdirSync(DIR).filter(f => f.endsWith('.md'));
  } catch {
    files = [];
  }
  const list = files.map(file => {
    const raw = fs.readFileSync(path.join(DIR, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    const words = body.split(/\s+/).filter(Boolean).length;
    return {
      slug: file.replace(/\.md$/, ''),
      title: meta.title || file,
      dek: meta.dek || '',
      audience: meta.audience || 'Everyone',
      order: Number.isFinite(Number(meta.order)) && meta.order !== undefined && meta.order !== '' ? Number(meta.order) : 99,
      body,
      readingMinutes: Math.max(1, Math.round(words / 220))
    } satisfies Resource;
  });
  cache = list.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return cache;
}

export function resourceBySlug(slug: string): Resource | undefined {
  return allResources().find(r => r.slug === slug);
}

export interface RenderedResource {
  slug: string;
  title: string;
  dek: string;
  audience: string;
  readingMinutes: number;
  html: string;
}

/** All resources with their markdown rendered to sanitized HTML. */
export function renderedResources(): RenderedResource[] {
  return allResources().map(r => ({
    slug: r.slug,
    title: r.title,
    dek: r.dek,
    audience: r.audience,
    readingMinutes: r.readingMinutes,
    html: renderMarkdown(r.body)
  }));
}
