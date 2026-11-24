// Regenerates lib/kmc-workshop/files.ts from the KMC interview .md.
// Run after editing the .md:  node scripts/gen-kmc-workshop-files.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const md = readFileSync('lib/kmc-workshop/KMC_Rhai_Dashboard_Interview.md', 'utf8');
writeFileSync(
  'lib/kmc-workshop/files.ts',
  `// The KMC workshop interview document, served as a download from /kmc-workshop.
// Source of truth: lib/kmc-workshop/KMC_Rhai_Dashboard_Interview.md. Kept as a
// string here so it ships in the server bundle without file tracing. After
// editing the .md, regenerate this file with: node scripts/gen-kmc-workshop-files.mjs

export const KMC_FILE_NAME = 'KMC_Rhai_Dashboard_Interview.md';

export const KMC_INTERVIEW_MD = ${JSON.stringify(md)};
`
);
