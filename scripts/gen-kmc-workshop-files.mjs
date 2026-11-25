// Regenerates lib/kmc-workshop/files.ts from the KMC interview .md files.
// Run after editing either .md:  node scripts/gen-kmc-workshop-files.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const NAMES = ['KMC_Rhai_Dashboard_Interview_Updated.md', 'KMC_Rhai_Dashboard_Interview.md'];
const entries = NAMES.map(n => `  ${JSON.stringify(n)}: ${JSON.stringify(readFileSync(`lib/kmc-workshop/${n}`, 'utf8'))}`);

writeFileSync(
  'lib/kmc-workshop/files.ts',
  `// The KMC workshop interview documents, served as downloads from /kmc-workshop.
// Source of truth: the .md files beside this one. Kept as strings here so they
// ship in the server bundle without file tracing. After editing a .md,
// regenerate this file with: node scripts/gen-kmc-workshop-files.mjs
//
// _Updated.md = the afternoon version, built on the morning's feedback (fix the
// page Rhea drafted for you). The plain one = the original (design from scratch).

export const KMC_FILES = {
${entries.join(',\n')}
} as const;

export type KmcFileName = keyof typeof KMC_FILES;
`
);
