import type { Provenance } from '@/lib/ontology/types';

const LABELS: Record<Provenance, { label: string; cls: string; title: string }> = {
  found_on_site: {
    label: 'on site',
    cls: 'badge-found',
    title: "Found directly on the company's own website."
  },
  inferred_public: {
    label: 'public',
    cls: 'badge-inferred',
    title: 'Inferred from public sources (news, reviews, job postings).'
  },
  agent_hypothesis: {
    label: 'hypothesis',
    cls: 'badge-hypothesis',
    title: 'A hypothesis from the agent — unconfirmed, treat as a question.'
  },
  user_provided: {
    label: 'you',
    cls: 'badge-user',
    title: 'Provided by you.'
  }
};

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const meta = LABELS[provenance];
  return (
    <span className={`badge ${meta.cls}`} title={meta.title}>
      {meta.label}
    </span>
  );
}
