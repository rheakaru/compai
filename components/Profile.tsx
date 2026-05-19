'use client';

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import type {
  AxisPositionClaim,
  Claim,
  FactClaim,
  HardProblemClaim,
  OneLinerClaim
} from '@/lib/model/claims';
import type { Ontology } from '@/lib/ontology/types';
import { OneLiner } from './OneLiner';
import { EditableAxisCard, type AxisEditPayload } from './EditableAxisCard';
import { ProblemMap } from './ProblemMap';
import { ProvenanceBadge } from './ProvenanceBadge';
import { OpenQuestionsPanel } from './OpenQuestionsPanel';
import { WhatChanged, type DiffSummary } from './WhatChanged';
import { AuthGateModal } from './AuthGateModal';
import { useAuth } from './AuthProvider';
import { TransferableSolutions } from './TransferableSolutions';
import { AnalogyAndProjects } from './AnalogyAndProjects';
import type { FiveProjects } from '@/lib/agent/projects';

export interface ProfileHandle {
  appendClaim: (claim: Claim) => void;
  setClaims: (claims: Claim[]) => void;
}

interface ProfileProps {
  initialClaims: Claim[];
  ontology: Ontology;
  companyId: string | null;
  companyUrl?: string | null;
  streaming?: boolean;
  initialProjects?: FiveProjects | null;
}

export const Profile = forwardRef<ProfileHandle, ProfileProps>(function Profile(
  { initialClaims, ontology, companyId, companyUrl, streaming = false, initialProjects = null },
  ref
) {
  const { user, getToken } = useAuth();
  const [claims, setClaims] = useState<Claim[]>(initialClaims);
  const [pendingEdit, setPendingEdit] = useState<AxisEditPayload | null>(null);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [diff, setDiff] = useState<DiffSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrollAxis, setScrollAxis] = useState<string | null>(null);
  const profileTopRef = useRef<HTMLDivElement | null>(null);
  const loggedViewRef = useRef(false);

  useImperativeHandle(ref, () => ({
    appendClaim(claim: Claim) {
      setClaims(prev => [...prev, claim]);
    },
    setClaims(next: Claim[]) {
      setClaims(next);
    }
  }));

  useEffect(() => {
    if (!companyId || loggedViewRef.current) return;
    loggedViewRef.current = true;
    fetch('/api/funnel/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        stage: 'profile_viewed',
        companyId,
        companyUrl: companyUrl ?? null
      })
    }).catch(() => undefined);
  }, [companyId, companyUrl]);

  const live = useMemo(
    () =>
      claims.filter(
        c =>
          c.supersededBy === null &&
          !(c.content as { _tombstoned?: boolean })?._tombstoned
      ),
    [claims]
  );

  const oneLiner = useMemo(() => {
    const all = live.filter((c): c is OneLinerClaim => c.kind === 'one_liner');
    return all.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  }, [live]);

  const facts = useMemo(() => live.filter((c): c is FactClaim => c.kind === 'fact'), [live]);
  const axisClaims = useMemo(() => {
    const all = live.filter((c): c is AxisPositionClaim => c.kind === 'axis_position');
    const byAxis = new Map<string, AxisPositionClaim>();
    for (const c of all) {
      const cur = byAxis.get(c.content.axisId);
      if (!cur || c.createdAt > cur.createdAt) byAxis.set(c.content.axisId, c);
    }
    return [...byAxis.values()];
  }, [live]);
  const hardProblems = useMemo(
    () => live.filter((c): c is HardProblemClaim => c.kind === 'hard_problem'),
    [live]
  );

  const sortedAxes = useMemo(
    () => [...ontology.axes].sort((a, b) => a.load_bearing_rank - b.load_bearing_rank),
    [ontology]
  );
  const loadBearing = sortedAxes.filter(a => a.load_bearing_rank <= 5);
  const refining = sortedAxes.filter(a => a.load_bearing_rank > 5);
  const axisClaimByAxisId = useMemo(() => {
    const m = new Map<string, AxisPositionClaim>();
    for (const c of axisClaims) m.set(c.content.axisId, c);
    return m;
  }, [axisClaims]);

  const canEdit = !!companyId && !streaming;

  const submitEdit = useCallback(
    async (payload: AxisEditPayload) => {
      if (!companyId) return;
      const claim = axisClaimByAxisId.get(payload.axisId);
      if (!claim) return;
      const prevOneLiner = oneLiner?.content.sentence ?? null;

      const headers: Record<string, string> = { 'content-type': 'application/json' };
      const token = await getToken();
      if (token) headers.authorization = `Bearer ${token}`;

      const res = await fetch('/api/corrections', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          companyId,
          claimId: claim.id,
          type: payload.type,
          userNote: payload.userNote,
          newAxisPosition: {
            axisId: payload.axisId,
            position: payload.position,
            confidence: payload.confidence
          }
        })
      });

      if (res.status === 401) {
        setPendingEdit(payload);
        setAuthGateOpen(true);
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? `Save failed (HTTP ${res.status}).`);
        return;
      }
      setError(null);
      const body = (await res.json()) as {
        diff: {
          removedClaimIds: string[];
          addedClaim: Claim;
          newHardProblems: HardProblemClaim[];
          newOneLiner: OneLinerClaim | null;
        };
      };
      const { removedClaimIds, addedClaim, newHardProblems, newOneLiner } = body.diff;
      const removed = new Set(removedClaimIds);
      setClaims(prev => {
        const next = prev.map(c =>
          removed.has(c.id) ? { ...c, supersededBy: c.supersededBy ?? 'superseded' } : c
        );
        next.push(addedClaim);
        for (const hp of newHardProblems) next.push(hp);
        if (newOneLiner) next.push(newOneLiner);
        return next;
      });
      setDiff({
        axisName: ontology.axes.find(a => a.id === payload.axisId)?.name ?? payload.axisId,
        beforePosition: claim.content.position,
        afterPosition: payload.position,
        beforeOneLiner: prevOneLiner,
        afterOneLiner: newOneLiner?.content.sentence ?? prevOneLiner,
        newProblemsAdded: newHardProblems.filter(h => !h.content.isDormant).length,
        problemsDropped: hardProblems.filter(h => !h.content.isDormant).length
      });
      profileTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [companyId, axisClaimByAxisId, hardProblems, ontology.axes, oneLiner, getToken]
  );

  const handleEditStart = useCallback(
    (axisId: string) => {
      if (!companyId) return;
      fetch('/api/funnel/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          stage: 'edit_started',
          companyId,
          companyUrl: companyUrl ?? null,
          meta: { axisId }
        })
      }).catch(() => undefined);
    },
    [companyId, companyUrl]
  );

  useEffect(() => {
    if (!scrollAxis) return;
    const el = document.querySelector<HTMLElement>(`[data-axis="${scrollAxis}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'box-shadow 0.4s';
      el.style.boxShadow = '0 0 0 3px rgba(198,74,31,0.35)';
      setTimeout(() => {
        if (el) el.style.boxShadow = '';
      }, 1500);
    }
    setScrollAxis(null);
  }, [scrollAxis]);

  // Retry pending edit after sign-in completes.
  useEffect(() => {
    if (user && pendingEdit) {
      const payload = pendingEdit;
      setPendingEdit(null);
      setAuthGateOpen(false);
      void submitEdit(payload);
    }
  }, [user, pendingEdit, submitEdit]);

  return (
    <div className="min-h-screen">
      <div ref={profileTopRef} />
      <OneLiner claim={oneLiner} streaming={streaming} />

      <div className="mx-auto max-w-4xl space-y-10 px-6 py-8">
        {!streaming && (
          <OpenQuestionsPanel
            axisClaims={axisClaims}
            ontology={ontology}
            onAnswer={axisId => setScrollAxis(axisId)}
          />
        )}

        <section>
          <SectionHeader
            title="Shape"
            subtitle="Where this company sits on the 9 structural axes — each with the evidence it rests on. Click 'correct' on any card to sharpen it."
          />
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-ink-400">Load-bearing</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {loadBearing.map(axis => (
                <EditableAxisCard
                  key={axis.id}
                  axis={axis}
                  claim={axisClaimByAxisId.get(axis.id) ?? null}
                  canEdit={canEdit}
                  onEditStart={() => handleEditStart(axis.id)}
                  onSubmit={submitEdit}
                />
              ))}
            </div>
            <p className="mt-6 text-[11px] uppercase tracking-wider text-ink-400">Refining</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {refining.map(axis => (
                <EditableAxisCard
                  key={axis.id}
                  axis={axis}
                  claim={axisClaimByAxisId.get(axis.id) ?? null}
                  canEdit={canEdit}
                  onEditStart={() => handleEditStart(axis.id)}
                  onSubmit={submitEdit}
                />
              ))}
            </div>
          </div>
        </section>

        <section>
          <SectionHeader
            title="What's hard for this shape"
            subtitle="Computed from the axis positions. Hot problems are what your structure makes load-bearing — not a vibe."
          />
          <ProblemMap claims={hardProblems} />
        </section>

        {!streaming && axisClaims.length >= 5 && (
          <section>
            <SectionHeader
              title="Transferable solutions"
              subtitle="The solved domains your shape maps to — or, honestly, where we stop seeing."
            />
            <TransferableSolutions axisClaims={axisClaims} ontology={ontology} />
          </section>
        )}

        {!streaming && companyId && axisClaims.length >= 5 && (
          <section>
            <SectionHeader
              title="Your 5 AI projects"
              subtitle="Gate 2 — the actual work, generated from your shape and your declared stack."
            />
            <AnalogyAndProjects companyId={companyId} initialProjects={initialProjects} />
          </section>
        )}

        {facts.length > 0 && (
          <section>
            <SectionHeader
              title="What we found"
              subtitle="Raw facts the agent gathered, with provenance."
            />
            <ul className="space-y-2">
              {facts.map(f => (
                <li key={f.id} className="card flex items-start gap-2 text-sm">
                  <ProvenanceBadge provenance={f.provenance} />
                  <span className="flex-1 text-ink-700">
                    {f.content.statement}
                    {f.content.source && (
                      <span className="ml-1 text-xs text-ink-400">· {truncate(f.content.source)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && (
          <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {error}
          </p>
        )}
      </div>

      <AuthGateModal
        open={authGateOpen}
        onClose={() => {
          setAuthGateOpen(false);
          setPendingEdit(null);
        }}
        onSignedIn={() => {
          /* the AuthProvider effect picks up the new user and retries pendingEdit */
        }}
      />

      <WhatChanged diff={diff} />
    </div>
  );
});

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold text-ink-900">{title}</h2>
      <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
    </div>
  );
}

function truncate(s: string): string {
  if (s.length <= 48) return s;
  try {
    const u = new URL(s);
    return u.hostname;
  } catch {
    return s.slice(0, 48) + '…';
  }
}
