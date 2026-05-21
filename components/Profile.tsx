'use client';

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import type {
  AxisPositionClaim,
  BrandingSnapshot,
  Claim,
  FactClaim,
  HardProblemClaim,
  OneLinerClaim,
  SynthesisClaim
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
import { BrandHeader } from './BrandHeader';
import { InviteOwnerSection } from './InviteOwnerSection';
import { SessionPlanSection } from './SessionPlan/SessionPlanSection';
import { ContextExportButton } from './ContextExportButton';
import { ContextGraphSection } from './ContextGraph/ContextGraphSection';
import { BookSessionFooter } from './BookSessionFooter';
import { CompanyNotes } from './CompanyNotes';
import { EditsBadge } from './EditsBadge';

// Mirrored from lib/limits/edits.ts (which is server-only and can't be
// imported here). If the server default changes, change this too.
const DEFAULT_MAX_EDITS = 3;
import { AXIS_DISPLAY_ORDER } from '@/lib/ontology/display-labels';
import { exportGateOpen, resolveExportGateLevel } from '@/lib/export/gate';
import type { FiveProjects } from '@/lib/agent/projects';
import type { SessionPlanContent } from '@/lib/agent/session-plan';
import type { ResolvedGate } from '@/lib/gate/commitment';
import type { GraphNode } from '@/lib/model/graph';

// Feature flags — sections that are off until we refine them. All upstream
// code (agents, routes, components) stays in place so these are one-line
// toggles to bring back later.
const SHOW_SESSION_PLAN = false;
const SHOW_TRANSFERABLE_SOLUTIONS = false;
const SHOW_FIVE_PROJECTS = false;

export interface ProfileHandle {
  appendClaim: (claim: Claim) => void;
  setClaims: (claims: Claim[]) => void;
  setBranding: (b: BrandingSnapshot | null) => void;
}

interface ProfileProps {
  initialClaims: Claim[];
  ontology: Ontology;
  companyId: string | null;
  companyUrl?: string | null;
  streaming?: boolean;
  initialProjects?: FiveProjects | null;
  initialBranding?: BrandingSnapshot | null;
  initialSessionPlan?: SessionPlanContent | null;
  sessionGate?: ResolvedGate | null;
  initialGraphNodes?: GraphNode[];
  initialUserNotes?: string;
  initialEditsUsed?: number;
  initialMaxEdits?: number;
  initialLockedAt?: number | null;
}

export const Profile = forwardRef<ProfileHandle, ProfileProps>(function Profile(
  {
    initialClaims,
    ontology,
    companyId,
    companyUrl,
    streaming = false,
    initialProjects = null,
    initialBranding = null,
    initialSessionPlan = null,
    sessionGate = null,
    initialGraphNodes = [],
    initialUserNotes = '',
    initialEditsUsed = 0,
    initialMaxEdits = DEFAULT_MAX_EDITS,
    initialLockedAt = null
  },
  ref
) {
  const { user, getToken } = useAuth();
  const [claims, setClaims] = useState<Claim[]>(initialClaims);
  const [branding, setBranding] = useState<BrandingSnapshot | null>(initialBranding);
  const [editsUsed, setEditsUsed] = useState(initialEditsUsed);
  const [lockedAt, setLockedAt] = useState<number | null>(initialLockedAt);
  const locked = lockedAt !== null || editsUsed >= initialMaxEdits;
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
    },
    setBranding(b: BrandingSnapshot | null) {
      setBranding(b);
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

  const synthesis = useMemo(() => {
    const all = live.filter((c): c is SynthesisClaim => c.kind === 'synthesis');
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

  // Display order is a frontend concern. AXIS_DISPLAY_ORDER interleaves
  // load-bearing and refining axes by narrative flow; the per-card
  // "Load · #n" / "Refining · #n" tag still comes from the ontology rank.
  const orderedAxes = useMemo(() => {
    const byId = new Map(ontology.axes.map(a => [a.id, a]));
    const ordered = AXIS_DISPLAY_ORDER.map(id => byId.get(id)).filter(
      (a): a is NonNullable<typeof a> => !!a
    );
    // Append any ontology axis not in the display order (defensive).
    for (const a of ontology.axes) {
      if (!AXIS_DISPLAY_ORDER.includes(a.id)) ordered.push(a);
    }
    return ordered;
  }, [ontology]);
  const axisClaimByAxisId = useMemo(() => {
    const m = new Map<string, AxisPositionClaim>();
    for (const c of axisClaims) m.set(c.content.axisId, c);
    return m;
  }, [axisClaims]);

  const canEdit = !!companyId && !streaming && !locked;

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

  const brandStyle = {
    '--brand': branding?.accentColor ?? '#c64a1f'
  } as React.CSSProperties;

  return (
    <div className="min-h-screen" style={brandStyle}>
      <div ref={profileTopRef} />
      <BrandHeader url={companyUrl ?? null} branding={branding} />
      {companyId && (
        <div className="border-b border-ink-100 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-end gap-3 px-6 py-2">
            <EditsBadge
              editsUsed={editsUsed}
              maxEdits={initialMaxEdits}
              locked={locked}
            />
          </div>
        </div>
      )}
      <OneLiner claim={oneLiner} synthesis={synthesis} streaming={streaming} />

      <div className="mx-auto max-w-4xl space-y-10 px-6 py-8">
        {locked && (
          <div className="card border-l-4 border-l-ink-800 bg-ink-50">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-800">
              Document locked
            </p>
            <p className="mt-1 text-sm text-ink-700">
              You&apos;ve used your {initialMaxEdits} free edits. The diagnosis you see is preserved
              and remains exportable. To keep iterating — re-running the analysis, correcting cards,
              inviting more coworkers — book a session with Rhea.
            </p>
            <a
              href="https://rheakaru.github.io/sessions.html"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium hover:opacity-80"
              style={{ color: 'var(--brand, #c64a1f)' }}
            >
              Book a session →
            </a>
          </div>
        )}

        {!streaming && companyId && (
          <CompanyNotes
            companyId={companyId}
            companyUrl={companyUrl ?? null}
            initialNotes={initialUserNotes}
            canEdit={canEdit}
            onEditStateChange={s => {
              setEditsUsed(s.editsUsed);
              if (s.editsUsed >= s.maxEdits) setLockedAt(Date.now());
            }}
          />
        )}

        {!streaming && (
          <OpenQuestionsPanel
            axisClaims={axisClaims}
            ontology={ontology}
            onAnswer={axisId => setScrollAxis(axisId)}
          />
        )}

        {!streaming && companyId && (
          <section>
            <ContextGraphSection
              companyId={companyId}
              initialNodes={initialGraphNodes}
              canEdit={canEdit}
            />
          </section>
        )}

        <section>
          <SectionHeader
            title="Shape"
            subtitle="Where you sit on 9 structural axes. Click any card to see evidence."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {orderedAxes.map(axis => (
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
        </section>

        <section>
          <SectionHeader
            title="What's hard"
            subtitle="Based on literature on company types and the axes we plotted you against."
          />
          <ProblemMap claims={hardProblems} />
        </section>

        {SHOW_TRANSFERABLE_SOLUTIONS && !streaming && axisClaims.length >= 5 && (
          <section>
            <SectionHeader title="Transferable solutions" />
            <TransferableSolutions axisClaims={axisClaims} ontology={ontology} />
          </section>
        )}

        {SHOW_FIVE_PROJECTS && !streaming && companyId && axisClaims.length >= 5 && (
          <section>
            <SectionHeader title="Your 5 AI projects" />
            <AnalogyAndProjects companyId={companyId} initialProjects={initialProjects} />
          </section>
        )}

        {SHOW_SESSION_PLAN && !streaming && companyId && sessionGate && initialProjects && (
          <section>
            <SectionHeader
              title="Your one day with Rhea"
              subtitle="The 4th node: the fixed session arc, inhabited by your diagnosis. Same six beats every company gets; what fills each beat is yours."
            />
            <SessionPlanSection
              companyId={companyId}
              companyName={branding?.name ?? null}
              gate={sessionGate}
              initialPlan={initialSessionPlan}
            />
          </section>
        )}

        {!streaming && companyId && (
          <section>
            <ContextExportButton
              companyId={companyId}
              companyName={branding?.name ?? null}
              gateLevel={resolveExportGateLevel(ontology)}
              gateOpen={exportGateOpen(
                {
                  hasAxes: axisClaims.length > 0,
                  hasProjects: !!initialProjects,
                  hasSessionPlan: !!initialSessionPlan
                },
                resolveExportGateLevel(ontology)
              )}
            />
          </section>
        )}

        {!streaming && companyId && user && (
          <section>
            <SectionHeader
              title="Roles"
              subtitle="Invite coworkers, see only the aggregate."
            />
            <InviteOwnerSection companyId={companyId} />
          </section>
        )}

        {facts.length > 0 && (
          <FactsSection facts={facts} />
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

      {!streaming && <BookSessionFooter />}
    </div>
  );
});

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
    </div>
  );
}

const FACT_CATEGORY_ORDER = [
  'company',
  'revenue',
  'industry',
  'competitors',
  'customers',
  'channels',
  'news',
  'other'
] as const;
type FactCat = (typeof FACT_CATEGORY_ORDER)[number];

const FACT_CATEGORY_LABELS: Record<FactCat, { label: string; hint: string }> = {
  company:     { label: 'The company',  hint: 'who they are, where, since when' },
  revenue:     { label: 'Scale',        hint: 'revenue, volume, headcount, growth' },
  industry:    { label: 'Industry',     hint: 'the broader market — size, growth, trends' },
  competitors: { label: 'Competitors',  hint: 'who else plays here and how big' },
  customers:   { label: 'Customers',    hint: 'who buys — named accounts or audience' },
  channels:    { label: 'Channels',     hint: 'how the product reaches the customer' },
  news:        { label: 'Recent',       hint: 'the last twelve months' },
  other:       { label: 'Other',        hint: 'things we found that did not fit a bucket' }
};

function FactsSection({ facts }: { facts: FactClaim[] }) {
  const grouped = new Map<FactCat, FactClaim[]>();
  for (const f of facts) {
    const cat = (f.content.category ?? 'other') as FactCat;
    const key = (FACT_CATEGORY_ORDER as readonly string[]).includes(cat) ? cat : 'other';
    const arr = grouped.get(key) ?? [];
    arr.push(f);
    grouped.set(key, arr);
  }
  const presentCats = FACT_CATEGORY_ORDER.filter(c => (grouped.get(c) ?? []).length > 0);

  return (
    <details className="card group" open={false}>
      <summary className="flex cursor-pointer items-baseline justify-between gap-2 list-none">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
            What we found
          </span>
          <span className="ml-2 text-[11px] text-ink-400">
            {facts.length} {facts.length === 1 ? 'fact' : 'facts'}
            {presentCats.length > 1 && ` across ${presentCats.length} buckets`}
          </span>
        </div>
        <span className="text-[11px] text-ink-400 group-open:hidden">show</span>
        <span className="hidden text-[11px] text-ink-400 group-open:inline">hide</span>
      </summary>
      <div className="mt-4 space-y-5">
        {presentCats.map(cat => {
          const items = grouped.get(cat) ?? [];
          const meta = FACT_CATEGORY_LABELS[cat];
          return (
            <div key={cat}>
              <div className="flex items-baseline gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-700">
                  {meta.label}
                </p>
                <p className="text-[11px] text-ink-400">— {meta.hint}</p>
              </div>
              <ul className="mt-2 space-y-1.5">
                {items.map(f => (
                  <li key={f.id} className="flex items-start gap-2 text-sm">
                    <ProvenanceBadge provenance={f.provenance} />
                    <span className="flex-1 text-ink-700">
                      {f.content.statement}
                      {f.content.source && (
                        <span className="ml-1 text-xs text-ink-400">
                          · {truncate(f.content.source)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </details>
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
