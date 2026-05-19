import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import type { Ontology } from './types';

let cached: { ontology: Ontology; hash: string; raw: string } | null = null;

export function loadOntology(): { ontology: Ontology; hash: string; raw: string } {
  if (cached) return cached;

  const filePath = path.join(process.cwd(), 'ontology.yaml');
  const raw = fs.readFileSync(filePath, 'utf8');
  const ontology = parseYaml(raw) as Ontology;
  const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);

  cached = { ontology, hash, raw };
  return cached;
}

export function getAxisById(id: string) {
  const { ontology } = loadOntology();
  return ontology.axes.find(a => a.id === id);
}

export function getLoadBearingAxes() {
  const { ontology } = loadOntology();
  return [...ontology.axes].sort((a, b) => a.load_bearing_rank - b.load_bearing_rank);
}
