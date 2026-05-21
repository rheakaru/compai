import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { randomUUID } from 'node:crypto';
import type { ResearchEvent } from './research';
import type { Claim, CompanyDoc } from '@/lib/model/claims';
import type { Provenance } from '@/lib/ontology/types';

const KNOWN_PROVENANCE = new Set<Provenance>([
  'found_on_site',
  'inferred_public',
  'agent_hypothesis',
  'user_provided'
]);

const KNOWN_CATEGORIES = new Set([
  'company',
  'revenue',
  'industry',
  'competitors',
  'customers',
  'channels',
  'news',
  'other'
]);

function coerceProvenance(v: unknown): Provenance {
  if (typeof v === 'string' && KNOWN_PROVENANCE.has(v as Provenance)) return v as Provenance;
  return 'agent_hypothesis';
}

export async function createCompany(opts: {
  url: string;
  sessionId: string;
  ownerUid: string | null;
  ontologyVersionHash: string;
  // Notes the user pasted on the landing page alongside the URL. We persist
  // them so the "Your context" box on the company page is pre-filled with
  // what they wrote — and so re-analysis reads the same notes as additional
  // context.
  userNotes?: string | null;
}): Promise<string> {
  const companyId = randomUUID();
  const doc: CompanyDoc = {
    ownerUid: opts.ownerUid,
    sessionId: opts.sessionId,
    url: opts.url,
    name: null,
    createdAt: Date.now(),
    ontologyVersionHash: opts.ontologyVersionHash,
    userNotes: opts.userNotes?.trim() || null
  };
  await adminDb().collection('companies').doc(companyId).set(doc);
  return companyId;
}

export function eventToClaim(event: ResearchEvent): Claim | null {
  const now = Date.now();
  const id = randomUUID();
  const base = {
    id,
    supersededBy: null,
    createdAt: now,
    confidence: typeof event.confidence === 'number' ? event.confidence : 0.7
  };

  switch (event.type) {
    case 'fact': {
      const statement = typeof event.statement === 'string' ? event.statement : null;
      if (!statement) return null;
      const category = typeof event.category === 'string' ? event.category : undefined;
      return {
        ...base,
        kind: 'fact',
        content: {
          statement,
          source: typeof event.source === 'string' ? event.source : undefined,
          category: KNOWN_CATEGORIES.has(category as never)
            ? (category as 'company' | 'revenue' | 'industry' | 'competitors' | 'customers' | 'channels' | 'news' | 'other')
            : undefined
        },
        provenance: coerceProvenance(event.provenance)
      };
    }
    case 'axis_position': {
      const axisId = typeof event.axisId === 'string' ? event.axisId : null;
      const position = typeof event.position === 'string' ? event.position : null;
      if (!axisId || !position) return null;
      const evidence = Array.isArray(event.evidence) ? event.evidence : [];
      const candidateA = event.candidateA && typeof event.candidateA === 'object'
        ? (event.candidateA as { position: string; implication: string })
        : undefined;
      const candidateB = event.candidateB && typeof event.candidateB === 'object'
        ? (event.candidateB as { position: string; implication: string })
        : undefined;
      let deviation: { magnitude: number; hotProblem: string } | undefined;
      if (event.deviation && typeof event.deviation === 'object') {
        const d = event.deviation as { magnitude?: unknown; hotProblem?: unknown };
        if (typeof d.magnitude === 'number' && typeof d.hotProblem === 'string') {
          deviation = {
            magnitude: Math.max(0, Math.min(1, d.magnitude)),
            hotProblem: d.hotProblem.slice(0, 200)
          };
        }
      }
      const plainSummary =
        typeof event.plainSummary === 'string' && event.plainSummary.trim()
          ? event.plainSummary.trim().slice(0, 240)
          : undefined;
      return {
        ...base,
        kind: 'axis_position',
        content: {
          axisId,
          position,
          confidence: base.confidence,
          evidence: evidence.map(e => {
            const ev = e as { source?: string; quote?: string; provenance?: string };
            return {
              source: ev.source ?? '',
              quote: ev.quote ?? '',
              provenance: coerceProvenance(ev.provenance)
            };
          }),
          candidateA,
          candidateB,
          disambiguatingQuestion:
            typeof event.disambiguatingQuestion === 'string' ? event.disambiguatingQuestion : undefined,
          plainSummary,
          deviation
        },
        provenance: 'agent_hypothesis'
      };
    }
    case 'one_liner': {
      const sentence = typeof event.sentence === 'string' ? event.sentence : null;
      if (!sentence) return null;
      return {
        ...base,
        kind: 'one_liner',
        content: { sentence, lowConfidence: event.lowConfidence === true },
        provenance: 'agent_hypothesis'
      };
    }
    default:
      return null;
  }
}

export async function persistClaim(companyId: string, claim: Claim): Promise<void> {
  await adminDb()
    .collection('companies')
    .doc(companyId)
    .collection('claims')
    .doc(claim.id)
    .set(claim);
}

export async function loadClaims(companyId: string): Promise<Claim[]> {
  const snap = await adminDb()
    .collection('companies')
    .doc(companyId)
    .collection('claims')
    .get();
  return snap.docs.map(d => d.data() as Claim);
}
