'use client';

import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { StackForm, type StackFormValues } from './StackForm';
import { AuthGateModal } from './AuthGateModal';
import type { FiveProjects, ProjectCard } from '@/lib/agent/projects';

export function AnalogyAndProjects({
  companyId,
  initialProjects
}: {
  companyId: string;
  initialProjects?: FiveProjects | null;
}) {
  const { user, getToken } = useAuth();
  const [result, setResult] = useState<FiveProjects | null>(initialProjects ?? null);
  const [authOpen, setAuthOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (v: StackFormValues) => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ companyId, stack: v })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { projects: FiveProjects };
      setResult(data.projects);
      fetch('/api/funnel/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stage: 'projects_viewed', companyId })
      }).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-6">
        <ProjectBlock title="Anchor project" project={result.anchor} accent />
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
            Supporting projects
          </h3>
          {result.supporting.map((p, i) => (
            <ProjectBlock key={i} project={p} />
          ))}
        </div>
        <div className="card border-l-4 border-l-ink-700 bg-ink-50">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
            Synthesis · what we learned about your business
          </h3>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-900">{result.synthesis}</p>
        </div>
      </div>
    );
  }

  if (!showForm) {
    return (
      <div className="card border-l-4 border-l-accent">
        <h3 className="text-lg font-semibold text-ink-900">Get your 5 AI projects</h3>
        <p className="mt-1 text-sm text-ink-600">
          One concrete anchor project, three supporting projects, and a synthesis of what we
          learned about your business. Generated from your shape and your stack — so every project
          is feasible on the tools you actually have.
        </p>
        <button
          type="button"
          onClick={() => {
            if (!user) {
              setAuthOpen(true);
              return;
            }
            setShowForm(true);
          }}
          className="mt-4 rounded-md px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--brand, #c64a1f)' }}
        >
          Start →
        </button>
        <AuthGateModal
          open={authOpen}
          onClose={() => setAuthOpen(false)}
          onSignedIn={() => {
            setAuthOpen(false);
            setShowForm(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StackForm onSubmit={onSubmit} submitting={submitting} />
      {error && (
        <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </p>
      )}
    </div>
  );
}

function ProjectBlock({
  project,
  title,
  accent
}: {
  project: ProjectCard;
  title?: string;
  accent?: boolean;
}) {
  return (
    <div className={`card ${accent ? 'border-l-4 border-l-accent' : ''}`}>
      {title && <p className="text-[11px] uppercase tracking-wider text-accent">{title}</p>}
      <h4 className="mt-1 text-base font-semibold text-ink-900">{project.title}</h4>
      <p className="mt-2 text-sm text-ink-800">
        <span className="font-medium">Artifact:</span> {project.artifact}
      </p>
      <p className="mt-1 text-sm text-ink-600">
        <span className="font-medium">Function:</span> {project.businessFunction}
      </p>
      <p className="mt-2 text-sm text-ink-700">{project.rationale}</p>
      {project.connectors.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {project.connectors.map((c, i) => (
            <span
              key={i}
              className="rounded bg-ink-100 px-2 py-0.5 text-[11px] font-mono text-ink-700"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
