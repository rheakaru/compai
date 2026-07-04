// Shared skill-scan logic — used by both scripts/rhai-sync-skills.ts
// (the CLI) and app/api/rhai/skills/sync (the "Sync now" button on the
// Skills tab). Both surfaces read the local ~/.claude/skills tree, so this
// module runs only on Node (never in the browser bundle).

import { readdirSync, readFileSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { DEFAULT_SKILLS, type RhaiSkill } from './types';

// ---------------------------------------------------------------------------
// Tiny YAML frontmatter parser — SKILL.md files use `key: value` and
// `key: |` block scalars only; no arrays/nesting needed.
// ---------------------------------------------------------------------------

export function parseFrontmatter(md: string): Record<string, string> | null {
  const m = /^---\s*\n([\s\S]*?)\n---/.exec(md);
  if (!m) return null;
  const out: Record<string, string> = {};
  let currentKey: string | null = null;
  let block: string[] = [];
  const flush = () => {
    if (currentKey) out[currentKey] = block.join(' ').trim();
    currentKey = null;
    block = [];
  };
  for (const line of m[1].split('\n')) {
    const blockStart = /^(\w[\w-]*):\s*\|\s*$/.exec(line);
    if (blockStart) {
      flush();
      currentKey = blockStart[1];
      continue;
    }
    const inline = /^(\w[\w-]*):\s*(.+)$/.exec(line);
    if (inline && !line.startsWith(' ')) {
      flush();
      out[inline[1]] = inline[2].trim().replace(/^["']|["']$/g, '');
      continue;
    }
    if (currentKey && (line.startsWith('  ') || line.startsWith('\t'))) {
      block.push(line.trim());
    }
  }
  flush();
  return out;
}

// ---------------------------------------------------------------------------
// Model routing — heuristic based on the skill's own name + description.
// ---------------------------------------------------------------------------

const M = {
  fable: 'claude-fable-5',
  opus: 'claude-opus-4-8',
  sonnet: 'claude-sonnet-5',
  haiku: 'claude-haiku-4-5-20251001'
} as const;

export function guessModel(name: string, desc: string): { model: string; stage?: string } {
  const s = `${name} ${desc}`.toLowerCase();
  const has = (...ws: string[]) => ws.some(w => s.includes(w));

  if (has('demo dashboard', 'build the dashboard', 'compile the dashboard'))
    return { model: M.fable, stage: 'build' };
  if (has('research', 'deep-research', 'audit', 'company-research'))
    return { model: M.opus, stage: 'research' };
  if (has('invoice', 'billing')) return { model: M.haiku, stage: 'billing' };
  if (has('launch-note', 'team-launch', 'whatsapp', 'reminder'))
    return { model: M.haiku, stage: 'comms' };
  if (has('email', 'closing email', 'workshop email')) return { model: M.haiku, stage: 'comms' };
  if (has('proposal', 'scoping', 'costing')) return { model: M.sonnet, stage: 'proposal' };
  if (has('presentation', 'deck', 'slides', 'workshop-modules'))
    return { model: M.sonnet, stage: 'prep' };
  if (has('blog', 'write-up', 'writeup', 'case study', 'feature-writeup'))
    return { model: M.sonnet, stage: 'closing' };
  if (has('marketing-engine', 'ontology', 'design')) return { model: M.opus, stage: 'build' };
  if (has('rosebazaar-dashboard', 'domain knowledge', 'reference'))
    return { model: M.sonnet, stage: 'context' };
  return { model: M.sonnet };
}

// ---------------------------------------------------------------------------
// Directory scan
// ---------------------------------------------------------------------------

export function scanSkillDir(dir: string): RhaiSkill[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const found: RhaiSkill[] = [];
  for (const name of entries) {
    const full = join(dir, name);
    try {
      if (!statSync(full).isDirectory()) continue;
    } catch {
      continue;
    }
    let md: string;
    try {
      md = readFileSync(join(full, 'SKILL.md'), 'utf8');
    } catch {
      continue;
    }
    const fm = parseFrontmatter(md);
    if (!fm?.name) continue;
    const description = (fm.description ?? '').trim();
    const { model, stage } = guessModel(fm.name, description);
    found.push({
      id: fm.name,
      name: fm.name,
      description: description.length > 500 ? description.slice(0, 500) + '…' : description,
      model,
      ...(stage ? { stage } : {}),
      enabled: true
    });
  }
  return found;
}

/** Scan the two standard locations for user + project skills. */
export function scanAllSkills(): { skills: RhaiSkill[]; sources: string[] } {
  const dirs = [join(homedir(), '.claude', 'skills'), join(process.cwd(), '.claude', 'skills')];
  const all: RhaiSkill[] = [];
  const sources: string[] = [];
  for (const dir of dirs) {
    const found = scanSkillDir(dir);
    if (found.length) sources.push(`${dir}: ${found.length}`);
    all.push(...found);
  }
  // Dedupe — project skills override user skills of the same name.
  const byId = new Map<string, RhaiSkill>();
  for (const s of all) byId.set(s.id, s);
  return { skills: [...byId.values()], sources };
}

// ---------------------------------------------------------------------------
// Merge with Firestore state — preserve user overrides; always union defaults
// so the 8 Anthropic-plugin skills can never silently disappear.
// ---------------------------------------------------------------------------

export function mergeSkills(
  stored: RhaiSkill[],
  discovered: RhaiSkill[]
): { merged: RhaiSkill[]; added: number; refreshed: number } {
  const storedIds = new Set(stored.map(s => s.id));
  const withDefaults: RhaiSkill[] = [
    ...stored,
    ...(DEFAULT_SKILLS as RhaiSkill[]).filter(d => !storedIds.has(d.id))
  ];
  const byId = new Map(withDefaults.map(s => [s.id, s]));

  let added = 0;
  let refreshed = 0;
  for (const s of discovered) {
    const prev = byId.get(s.id);
    if (prev) {
      // Preserve user's model + enabled; refresh description; only fill stage if empty.
      byId.set(s.id, {
        ...prev,
        description: s.description,
        ...(prev.stage ? {} : s.stage ? { stage: s.stage } : {})
      });
      refreshed++;
    } else {
      byId.set(s.id, s);
      added++;
    }
  }
  return { merged: [...byId.values()], added, refreshed };
}
