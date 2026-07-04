'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import {
  type CalToken,
  type BusyInterval,
  type CalEvent,
  connectGoogleCalendar,
  getBusy,
  insertEvent,
  isCalAuthError,
  listUpcomingEvents,
  loadToken
} from '@/lib/leads/calendar';
import {
  BILLING_LABELS,
  DAY_RATE_INR,
  DEAD_STAGES,
  JUNE_TARGET_INR,
  LIKELIHOOD_LABELS,
  STAGE_LABELS,
  STAGE_ORDER,
  TYPE_LABELS,
  formatINR,
  formatLakh,
  leadOrder,
  leadValue,
  normalizeLead,
  revenueBuckets,
  type Billing,
  type Likelihood,
  type LeadStage,
  type LeadType,
  type WorkshopLead
} from '@/lib/leads/types';

// Stages that make sense for free (top-of-funnel) rows — no invoice/payment.
const OUTREACH_STAGES: LeadStage[] = [
  'interested',
  'discovery_call',
  'workshop_scheduled',
  'delivered',
  'closed',
  'gone_cold',
  'lost'
];

const LIKELIHOOD_DOT: Record<Likelihood, string> = {
  hot: 'bg-accent',
  warm: 'bg-amber-400',
  cold: 'bg-ink-300'
};

export function LeadsDashboard() {
  const { user, getToken, signIn } = useAuth();
  const [leads, setLeads] = useState<WorkshopLead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeadType | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [calToken, setCalToken] = useState<CalToken | null>(null);
  const [calBusy, setCalBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    setCalToken(loadToken());
  }, []);

  const connectCal = useCallback(async (): Promise<CalToken | null> => {
    setCalBusy(true);
    try {
      const t = await connectGoogleCalendar();
      setCalToken(t);
      return t;
    } catch {
      return null;
    } finally {
      setCalBusy(false);
    }
  }, []);

  const authedFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const token = await getToken();
      return fetch(path, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        }
      });
    },
    [getToken]
  );

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const res = await authedFetch('/api/leads');
        if (res.status === 403) {
          setError("You're signed in, but this account is not the operator.");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = (await res.json()) as { leads: WorkshopLead[] };
        setLeads(d.leads.map(normalizeLead));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authedFetch]);

  const patch = useCallback(
    async (id: string, partial: Partial<WorkshopLead>) => {
      setLeads(prev => (prev ? prev.map(l => (l.id === id ? { ...l, ...partial } : l)) : prev));
      try {
        await authedFetch(`/api/leads/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(partial)
        });
      } catch {
        // optimistic; a reload re-syncs from the server
      }
    },
    [authedFetch]
  );

  const addLead = useCallback(async () => {
    try {
      const res = await authedFetch('/api/leads', {
        method: 'POST',
        body: JSON.stringify({ person: '', company: '', type: 'company', billing: 'paid', stage: 'interested' })
      });
      const d = (await res.json()) as { lead: WorkshopLead };
      const lead = normalizeLead(d.lead);
      setLeads(prev => (prev ? [lead, ...prev] : [lead]));
      setExpanded(lead.id);
    } catch {
      /* ignore */
    }
  }, [authedFetch]);

  const removeLead = useCallback(
    async (id: string) => {
      if (!confirm('Delete this lead?')) return;
      setLeads(prev => (prev ? prev.filter(l => l.id !== id) : prev));
      if (expanded === id) setExpanded(null);
      try {
        await authedFetch(`/api/leads/${id}`, { method: 'DELETE' });
      } catch {
        /* ignore */
      }
    },
    [authedFetch, expanded]
  );

  // Drag `dragId` to sit just before `overId`, renumber every row to a clean
  // integer order, optimistically re-sort, and persist only the rows whose
  // order actually changed. Reorder acts on the full list, so it's only
  // enabled on the "all" view (a filtered subset can't express a global order).
  const reorderLeads = useCallback(
    (fromId: string, overId: string) => {
      if (fromId === overId) return;
      setLeads(prev => {
        if (!prev) return prev;
        const sorted = prev.slice().sort((a, b) => leadOrder(a) - leadOrder(b));
        const fromIdx = sorted.findIndex(l => l.id === fromId);
        const overIdx = sorted.findIndex(l => l.id === overId);
        if (fromIdx === -1 || overIdx === -1) return prev;
        const [moved] = sorted.splice(fromIdx, 1);
        const insertAt = sorted.findIndex(l => l.id === overId);
        sorted.splice(insertAt, 0, moved);

        const changed: { id: string; order: number }[] = [];
        const renumbered = sorted.map((l, i) => {
          if (l.order !== i) changed.push({ id: l.id, order: i });
          return { ...l, order: i };
        });
        // Persist changed rows (fire-and-forget; a reload re-syncs from server).
        for (const c of changed) {
          authedFetch(`/api/leads/${c.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ order: c.order })
          }).catch(() => undefined);
        }
        return renumbered;
      });
    },
    [authedFetch]
  );

  // -------------------- gates --------------------
  if (!user) {
    return (
      <Wrapper>
        <p className="text-ink-700">Sign in with the operator account to view your leads.</p>
        <button
          type="button"
          onClick={() => signIn().catch(() => undefined)}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
        >
          Sign in with Google
        </button>
      </Wrapper>
    );
  }
  if (loading)
    return (
      <Wrapper>
        <p className="text-ink-500">Loading…</p>
      </Wrapper>
    );
  if (error)
    return (
      <Wrapper>
        <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>
      </Wrapper>
    );

  const all = (leads ?? []).slice().sort((a, b) => leadOrder(a) - leadOrder(b));
  const visible = filter === 'all' ? all : all.filter(l => l.type === filter);
  const buckets = revenueBuckets(all);
  const jobConnects = all.filter(l => l.jobConnect);
  const orgScheduled = all.filter(l => l.type === 'org' && l.stage !== 'interested' && !DEAD_STAGES.includes(l.stage));
  const paidWon = all.filter(l => l.billing === 'paid' && (l.paymentReceived || l.stage === 'paid' || l.stage === 'closed'));

  return (
    <Wrapper>
      {/* ---- target + progress ---- */}
      <section className="rounded-lg border border-ink-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-ink-500">June revenue target</p>
            <p className="mt-0.5 text-3xl font-semibold text-ink-900">{formatLakh(JUNE_TARGET_INR)}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-ink-900">{formatINR(buckets.banked)}</p>
            <p className="text-[11px] text-ink-500">banked · {formatINR(buckets.pipeline)} full pipeline</p>
          </div>
        </div>
        <ProgressBar buckets={buckets} target={JUNE_TARGET_INR} />
        <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-ink-600">
          <Legend dot="bg-emerald-600" label="Banked" value={buckets.banked} />
          <Legend dot="bg-accent" label="Hot" value={buckets.hot} />
          <Legend dot="bg-amber-400" label="Warm" value={buckets.warm} />
          <Legend dot="bg-ink-300" label="Cold" value={buckets.cold} />
        </div>
      </section>

      {/* ---- glanceable calendar ---- */}
      <div className="mt-4">
        <AvailabilityStrip calToken={calToken} calBusy={calBusy} onConnectCal={connectCal} />
        {calToken && leads && (
          <CalendarLeadSync calToken={calToken} leads={leads} onPatch={patch} />
        )}
      </div>

      {/* ---- goals ---- */}
      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <GoalCard
          title="Teach AI at scale"
          body="Build a large base of people I teach AI to — free sessions and org talks feed the funnel."
        />
        <GoalCard
          title="Convert 4 companies / month"
          body="Turn 4 companies monthly into ₹3-lakh paid engagements (recce + build days)."
          stat={`${paidWon.length} won this month`}
        />
        <GoalCard
          title="Land an AI role in SF"
          body="AI Educator / advocate / forward-deployed engineer — via connects made through these sessions."
          stat={`${jobConnects.length} job-connects flagged`}
        />
      </section>

      {/* ---- outreach + job-connect strips ---- */}
      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Paid engagements won" value={String(paidWon.length)} sub="goal: 4 / month" />
        <Stat label="Org sessions scheduled+" value={String(orgScheduled.length)} sub="CREDAI · YPO · EO · FICCI FLO …" />
        <Stat
          label="Job-connect leads"
          value={String(jobConnects.length)}
          sub={jobConnects.length ? jobConnects.map(j => j.company || j.person).filter(Boolean).slice(0, 3).join(' · ') : 'Anthropic · Sarvam …'}
        />
      </section>

      {/* ---- leads table ---- */}
      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>
              All · {all.length}
            </FilterBtn>
            {(['company', 'org', 'community'] as LeadType[]).map(t => (
              <FilterBtn key={t} active={filter === t} onClick={() => setFilter(t)}>
                {TYPE_LABELS[t]} · {all.filter(l => l.type === t).length}
              </FilterBtn>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => connectCal()}
              disabled={calBusy}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                calToken
                  ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
              }`}
              title={calToken ? 'Calendar connected for this session' : 'Connect Google Calendar to plan dates'}
            >
              {calBusy ? 'Connecting…' : calToken ? '✓ Calendar connected' : 'Connect Google Calendar'}
            </button>
            <button
              type="button"
              onClick={addLead}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-600"
            >
              + Add lead
            </button>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
            No leads yet. Click “Add lead”.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map(l => (
              <LeadCard
                key={l.id}
                lead={l}
                expanded={expanded === l.id}
                onToggle={() => setExpanded(expanded === l.id ? null : l.id)}
                onPatch={patch}
                onDelete={removeLead}
                calToken={calToken}
                onConnectCal={connectCal}
                authedFetch={authedFetch}
                dragEnabled={filter === 'all'}
                isDragging={dragId === l.id}
                dragTarget={dragId !== null && dragId !== l.id}
                onDragStart={() => setDragId(l.id)}
                onDragEnd={() => setDragId(null)}
                onDropOn={() => {
                  if (dragId) reorderLeads(dragId, l.id);
                  setDragId(null);
                }}
              />
            ))}
          </div>
        )}
      </section>
    </Wrapper>
  );
}

// ===========================================================================
// Row + expandable editor
// ===========================================================================

// Stage → chip color, so the funnel position reads at a glance.
const STAGE_CHIP: Partial<Record<LeadStage, string>> = {
  interested: 'bg-ink-100 text-ink-600',
  discovery_call: 'bg-sky-50 text-sky-700',
  recce_scheduled: 'bg-indigo-50 text-indigo-700',
  workshop_scheduled: 'bg-violet-50 text-violet-700',
  delivered: 'bg-amber-50 text-amber-800',
  paid: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-emerald-100 text-emerald-800',
  gone_cold: 'bg-ink-50 text-ink-400',
  lost: 'bg-rose-50 text-rose-600'
};

const STRENGTH_BORDER: Record<Likelihood, string> = {
  hot: 'border-l-accent',
  warm: 'border-l-amber-400',
  cold: 'border-l-ink-200'
};

function LeadCard({
  lead,
  expanded,
  onToggle,
  onPatch,
  onDelete,
  calToken,
  onConnectCal,
  authedFetch,
  dragEnabled,
  isDragging,
  dragTarget,
  onDragStart,
  onDragEnd,
  onDropOn
}: {
  lead: WorkshopLead;
  expanded: boolean;
  onToggle: () => void;
  onPatch: (id: string, p: Partial<WorkshopLead>) => void;
  onDelete: (id: string) => void;
  calToken: CalToken | null;
  onConnectCal: () => Promise<CalToken | null>;
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
  dragEnabled: boolean;
  isDragging: boolean;
  dragTarget: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOn: () => void;
}) {
  const value = leadValue(lead);
  const stages = lead.billing === 'paid' ? STAGE_ORDER : OUTREACH_STAGES;
  // Show a date only once something is actually scheduled.
  const scheduledDate = lead.workshopDate || lead.recce?.date || '';

  return (
    <div
      className={`${expanded ? 'sm:col-span-2 xl:col-span-3' : ''} rounded-lg border border-l-[3px] border-ink-200 ${
        STRENGTH_BORDER[lead.likelihood]
      } bg-white p-3 transition-shadow hover:shadow-sm ${isDragging ? 'opacity-40' : ''} ${
        dragTarget ? 'ring-1 ring-accent' : ''
      }`}
      onDragOver={e => {
        if (dragEnabled && dragTarget) e.preventDefault();
      }}
      onDrop={e => {
        if (!dragEnabled) return;
        e.preventDefault();
        onDropOn();
      }}
    >
      {/* header: name/company + actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          {dragEnabled && (
            <span
              draggable
              onDragStart={e => {
                e.dataTransfer.effectAllowed = 'move';
                onDragStart();
              }}
              onDragEnd={onDragEnd}
              className="mt-0.5 cursor-grab select-none text-ink-300 active:cursor-grabbing"
              title="Drag to reorder by importance"
            >
              ⋮⋮
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <InlineText
                value={lead.person}
                placeholder="Person"
                className="font-medium text-ink-900"
                onSave={v => onPatch(lead.id, { person: v })}
              />
              {lead.jobConnect && (
                <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-800">
                  SF
                </span>
              )}
            </div>
            <InlineText
              value={lead.company}
              placeholder="Company"
              className="text-[11px] text-ink-500"
              onSave={v => onPatch(lead.id, { company: v })}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 text-ink-400">
          {lead.person && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('rhai:openPerson', { detail: { name: lead.person } }))}
              className="rounded px-1 text-[11px] text-indigo-500 hover:bg-indigo-50"
              title="Rhai's context on this person"
            >
              ⓘ
            </button>
          )}
          <Link
            href={`/leads/${lead.id}`}
            className="rounded px-1 text-[11px] hover:bg-ink-50 hover:text-ink-800"
            title="Open client workspace — notes, understanding, Rhai's scan"
          >
            ↗
          </Link>
          <button
            type="button"
            onClick={onToggle}
            className="rounded px-1 text-[11px] hover:bg-ink-50 hover:text-ink-800"
            title={expanded ? 'Collapse' : 'Quick edit'}
          >
            {expanded ? '⌃' : '⌄'}
          </button>
        </div>
      </div>

      {/* stage chip + value */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <select
          value={lead.stage}
          onChange={e => onPatch(lead.id, { stage: e.target.value as LeadStage })}
          className={`cursor-pointer rounded-full border-0 py-0.5 pl-2 pr-1 text-[11px] font-medium ${
            STAGE_CHIP[lead.stage] ?? 'bg-ink-100 text-ink-600'
          }`}
        >
          {stages.map(s => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 text-xs">
          {scheduledDate && (
            <span className="text-[11px] text-ink-400">
              📅 {new Date(scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {lead.billing === 'paid' ? (
            <span className={lead.paymentReceived ? 'font-semibold text-emerald-700' : 'font-medium text-ink-700'}>
              {formatINR(value)}
            </span>
          ) : (
            <span className="text-ink-300">free</span>
          )}
        </div>
      </div>

      {/* next step */}
      <div className="mt-1.5 flex items-start gap-1">
        <InlineText
          value={lead.nextSteps}
          placeholder="Next step…"
          className="text-xs text-ink-700"
          onSave={v => onPatch(lead.id, { nextSteps: v })}
        />
        <NextStepsHistory leadId={lead.id} />
      </div>

      {expanded && (
        <div className="mt-3 border-t border-ink-100 pt-3">
          <QuickAttrs lead={lead} onPatch={onPatch} onDelete={onDelete} />
          <div className="mt-3">
            <LeadEditor
              lead={lead}
              onPatch={onPatch}
              onDelete={onDelete}
              calToken={calToken}
              onConnectCal={onConnectCal}
              authedFetch={authedFetch}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Type / billing / strength — the attributes we pulled off the card face.
// They live in the expanded quick-edit strip so the glance view stays clean.
function QuickAttrs({
  lead,
  onPatch,
  onDelete
}: {
  lead: WorkshopLead;
  onPatch: (id: string, p: Partial<WorkshopLead>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1 text-[11px] text-ink-500">
        Type
        <select
          value={lead.type}
          onChange={e => onPatch(lead.id, { type: e.target.value as LeadType })}
          className="rounded border border-ink-200 bg-white px-1.5 py-1 text-xs text-ink-700"
        >
          {(['company', 'org', 'community'] as LeadType[]).map(t => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <select
        value={lead.billing}
        onChange={e => onPatch(lead.id, { billing: e.target.value as Billing })}
        className={`rounded border px-1.5 py-1 text-xs ${
          lead.billing === 'paid'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-ink-200 bg-ink-50 text-ink-500'
        }`}
      >
        {(['paid', 'free'] as Billing[]).map(bk => (
          <option key={bk} value={bk}>
            {BILLING_LABELS[bk]}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-[11px] text-ink-500">
        Strength
        <select
          value={lead.likelihood}
          onChange={e => onPatch(lead.id, { likelihood: e.target.value as Likelihood })}
          className="rounded border border-ink-200 bg-white px-1.5 py-1 text-xs text-ink-700"
        >
          {(['hot', 'warm', 'cold'] as Likelihood[]).map(k => (
            <option key={k} value={k}>
              {LIKELIHOOD_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1 text-[11px] text-ink-500">
        Date
        <InlineDate value={lead.dateLabel} onSave={v => onPatch(lead.id, { dateLabel: v })} />
      </label>
      <button
        type="button"
        onClick={() => onDelete(lead.id)}
        title="Delete lead"
        className="ml-auto rounded px-2 py-1 text-xs text-ink-400 hover:bg-rose-50 hover:text-rose-600"
      >
        ✕ Delete
      </button>
    </div>
  );
}

function LeadEditor({
  lead,
  onPatch,
  onDelete,
  calToken,
  onConnectCal,
  authedFetch
}: {
  lead: WorkshopLead;
  onPatch: (id: string, p: Partial<WorkshopLead>) => void;
  onDelete: (id: string) => void;
  calToken: CalToken | null;
  onConnectCal: () => Promise<CalToken | null>;
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const recce = lead.recce ?? {};
  const setRecce = (p: Partial<typeof recce>) => onPatch(lead.id, { recce: { ...recce, ...p } });
  const setCheck = (k: keyof WorkshopLead['checklist'], v: boolean) =>
    onPatch(lead.id, { checklist: { ...lead.checklist, [k]: v } });
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-4">
      {/* Smart notes — the thing you actually use during calls, front and centre. */}
      <SmartNotes lead={lead} onPatch={onPatch} authedFetch={authedFetch} />

      <button
        type="button"
        onClick={() => setShowDetails(s => !s)}
        className="text-[11px] font-medium text-ink-500 hover:text-ink-800"
      >
        {showDetails ? '▾ Hide logistics, checklist & email' : '▸ Logistics, checklist & email'}
      </button>

      {showDetails && (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* budgeting + links */}
      <div className="space-y-4">
        <Field label="Budgeting">
          <div className="flex items-center gap-2 text-sm">
            <NumberInput
              value={lead.estimatedDays}
              onSave={v => onPatch(lead.id, { estimatedDays: v })}
              className="w-16"
            />
            <span className="text-ink-500">days ×</span>
            <NumberInput
              value={lead.dayRate}
              step={10000}
              onSave={v => onPatch(lead.id, { dayRate: v })}
              className="w-28"
            />
          </div>
          <p className="mt-1 text-xs text-ink-500">
            = <span className="font-medium text-ink-800">{formatINR(leadValue(lead))}</span> · standard rate{' '}
            {formatINR(DAY_RATE_INR)}/day
          </p>
        </Field>

        <ToggleRow
          label="Payment received"
          checked={lead.paymentReceived}
          onChange={v => onPatch(lead.id, { paymentReceived: v })}
        />

        <Field label="Discovery call notes (link)">
          <InlineText
            value={lead.discoveryCallNotesUrl ?? ''}
            placeholder="https://…"
            className="text-xs text-ink-700 underline-offset-2"
            onSave={v => onPatch(lead.id, { discoveryCallNotesUrl: v })}
          />
        </Field>

        <Field label="Recce day">
          <div className="grid grid-cols-2 gap-2">
            <LabeledInput label="Date" value={recce.date ?? ''} onSave={v => setRecce({ date: v })} />
            <LabeledInput label="Time" value={recce.time ?? ''} onSave={v => setRecce({ time: v })} />
          </div>
          <LabeledInput label="Location" value={recce.location ?? ''} onSave={v => setRecce({ location: v })} />
          <LabeledInput label="Recce notes (link)" value={recce.notesUrl ?? ''} onSave={v => setRecce({ notesUrl: v })} />
        </Field>

        <Field label="Workshop / session date">
          <InlineText
            value={lead.workshopDate ?? ''}
            placeholder="Locked build-day date…"
            className="text-sm text-ink-800"
            onSave={v => onPatch(lead.id, { workshopDate: v })}
          />
        </Field>

        <CalendarSection lead={lead} calToken={calToken} onConnectCal={onConnectCal} onPatch={onPatch} />
      </div>

      {/* journey checklist */}
      <div className="space-y-1">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Engagement journey</p>
        <ToggleRow label="Engagement email sent (pre-recce)" checked={lead.checklist.engagementEmailSent} onChange={v => setCheck('engagementEmailSent', v)} />
        <ToggleRow label="Prep ready (deck / demo app)" checked={lead.checklist.prepReady} onChange={v => setCheck('prepReady', v)} />
        <ToggleRow label="Invoice sent (pre-session)" checked={lead.checklist.invoiceSent} onChange={v => setCheck('invoiceSent', v)} />
        <ToggleRow label="Closing email sent" checked={lead.checklist.closingEmailSent} onChange={v => setCheck('closingEmailSent', v)} />
        <ToggleRow label="Payment reminder sent (if late)" checked={lead.checklist.paymentReminderSent} onChange={v => setCheck('paymentReminderSent', v)} />
        <ToggleRow label="Blog post written" checked={lead.checklist.blogPostWritten} onChange={v => setCheck('blogPostWritten', v)} />
        <ToggleRow label="Posted on Twitter + Instagram" checked={lead.checklist.postedSocial} onChange={v => setCheck('postedSocial', v)} />

        <div className="!mt-4">
          <ToggleRow
            label="Job-connect (Anthropic / Sarvam / SF)"
            checked={lead.jobConnect}
            onChange={v => onPatch(lead.id, { jobConnect: v })}
          />
          {lead.jobConnect && (
            <textarea
              defaultValue={lead.jobConnectNotes ?? ''}
              onBlur={e => onPatch(lead.id, { jobConnectNotes: e.target.value })}
              placeholder="Who's the connect, what's the angle…"
              className="mt-1 w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs text-ink-700"
              rows={2}
            />
          )}
        </div>
      </div>

      {/* email template + notes */}
      <div className="space-y-4">
        <EngagementEmail lead={lead} />
        <Field label="Notes">
          <textarea
            defaultValue={lead.notes ?? ''}
            onBlur={e => onPatch(lead.id, { notes: e.target.value })}
            placeholder="Anything else about this lead…"
            className="w-full rounded border border-ink-200 bg-white px-2 py-1.5 text-xs text-ink-700"
            rows={4}
          />
        </Field>
        <button
          type="button"
          onClick={() => onDelete(lead.id)}
          className="text-xs text-rose-600 hover:underline"
        >
          Delete lead
        </button>
      </div>
    </div>
      )}
    </div>
  );
}

// ===========================================================================
// Smart notes — Google-doc-style running notes + handwritten-photo transcription
// ===========================================================================

function SmartNotes({
  lead,
  onPatch,
  authedFetch
}: {
  lead: WorkshopLead;
  onPatch: (id: string, p: Partial<WorkshopLead>) => void;
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const [text, setText] = useState(lead.smartNotes ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [transcribing, setTranscribing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autosave — commits ~1s after you stop typing.
  const scheduleSave = useCallback(
    (value: string) => {
      setStatus('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        onPatch(lead.id, { smartNotes: value, smartNotesUpdatedAt: Date.now() });
        setStatus('saved');
      }, 900);
    },
    [lead.id, onPatch]
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setErr(null);
      setTranscribing(true);
      try {
        const images = await Promise.all(
          Array.from(files).map(
            f =>
              new Promise<string>((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(String(r.result));
                r.onerror = () => reject(new Error('Could not read file'));
                r.readAsDataURL(f);
              })
          )
        );
        const res = await authedFetch(`/api/leads/${lead.id}/transcribe`, {
          method: 'POST',
          body: JSON.stringify({ images })
        });
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
        const { text: transcribed } = (await res.json()) as { text: string };
        const stamp = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const merged = `${text ? text.trimEnd() + '\n\n' : ''}— transcribed handwritten notes (${stamp}) —\n${transcribed}`;
        setText(merged);
        scheduleSave(merged);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Transcription failed');
      } finally {
        setTranscribing(false);
      }
    },
    [authedFetch, lead.id, text, scheduleSave]
  );

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Smart notes</p>
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-medium text-indigo-700">Rhai reads these</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-ink-400">
          <span>
            {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}
          </span>
          <label className="cursor-pointer rounded border border-ink-200 px-2 py-1 text-ink-600 hover:bg-ink-50">
            {transcribing ? 'Transcribing…' : '📷 Transcribe handwriting'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              className="hidden"
              disabled={transcribing}
              onChange={e => {
                onFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>
      <textarea
        value={text}
        onChange={e => {
          setText(e.target.value);
          scheduleSave(e.target.value);
        }}
        placeholder="Type notes live during the call — action items, requirements, who said what. Or drop in photos of your handwritten notes to transcribe. Rhai uses this to suggest next steps and prep your deck & demo."
        className="h-56 w-full resize-y rounded border border-ink-200 bg-white px-3 py-2 text-sm leading-relaxed text-ink-800 focus:border-ink-300 focus:outline-none"
      />
      {err && <p className="mt-1 text-[11px] text-rose-600">{err}</p>}
    </div>
  );
}

// ===========================================================================
// Google Calendar: availability strip + push recce / workshop dates
// ===========================================================================

const AVAIL_DAYS = 21;
const DEFAULT_DURATION_HOURS = 6; // an on-site day

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** datetime-local value for tomorrow at 10:00, local time. */
function defaultSlot(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Always-visible calendar glance at the top of the dashboard: your next-21-days
 * availability plus the soonest events, so recce/build days are visible without
 * opening a lead. Uses the persisted token, with a one-click reconnect.
 */
function AvailabilityStrip({
  calToken,
  calBusy,
  onConnectCal
}: {
  calToken: CalToken | null;
  calBusy: boolean;
  onConnectCal: () => Promise<CalToken | null>;
}) {
  const [busy, setBusy] = useState<BusyInterval[] | null>(null);
  const [events, setEvents] = useState<CalEvent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!calToken) {
      setBusy(null);
      setEvents(null);
      return;
    }
    let cancelled = false;
    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + AVAIL_DAYS);
    setErr(null);
    getBusy(calToken.accessToken, now, end)
      .then(b => !cancelled && setBusy(b))
      .catch(e =>
        !cancelled &&
        setErr(isCalAuthError(e) ? 'Calendar access expired — reconnect.' : e instanceof Error ? e.message : 'Could not load calendar.')
      );
    listUpcomingEvents(calToken.accessToken, now, end, 8)
      .then(ev => !cancelled && setEvents(ev))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [calToken]);

  if (!calToken) {
    return (
      <section className="rounded-lg border border-dashed border-ink-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-500">Connect Google Calendar to see your availability and scheduled recce / build days at a glance.</p>
          <button
            type="button"
            onClick={() => onConnectCal()}
            disabled={calBusy}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-600 disabled:opacity-60"
          >
            {calBusy ? 'Connecting…' : 'Connect Google Calendar'}
          </button>
        </div>
      </section>
    );
  }

  const busyDays = new Set<string>();
  if (busy) {
    for (const b of busy) {
      const s = new Date(b.start);
      const e = new Date(b.end);
      const cur = new Date(s);
      cur.setHours(0, 0, 0, 0);
      while (cur <= e) {
        const winStart = new Date(cur);
        winStart.setHours(9, 0, 0, 0);
        const winEnd = new Date(cur);
        winEnd.setHours(18, 0, 0, 0);
        if (s < winEnd && e > winStart) busyDays.add(dayKey(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }
  }

  const days: Date[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < AVAIL_DAYS; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  const connectedUntil = new Date(calToken.expiresAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

  return (
    <section className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Calendar · next {AVAIL_DAYS} days</p>
        <div className="flex items-center gap-3 text-[10px] text-ink-400">
          <span className="text-emerald-700">✓ connected until {connectedUntil}</span>
          <button type="button" onClick={() => onConnectCal()} disabled={calBusy} className="underline hover:text-ink-700">
            {calBusy ? 'reconnecting…' : 'reconnect'}
          </button>
        </div>
      </div>

      {err && <p className="mb-2 text-[11px] text-rose-600">{err}</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div>
          <div className="flex flex-wrap gap-1">
            {days.map(d => {
              const isBusy = busyDays.has(dayKey(d));
              const weekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div
                  key={dayKey(d)}
                  title={`${d.toDateString()} — ${isBusy ? 'busy' : weekend ? 'weekend' : 'free'}`}
                  className={`flex h-10 w-9 flex-col items-center justify-center rounded text-[9px] ${
                    isBusy ? 'bg-rose-100 text-rose-700' : weekend ? 'bg-ink-100 text-ink-400' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  <span>{['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]}</span>
                  <span className="font-medium">{d.getDate()}</span>
                </div>
              );
            })}
          </div>
          {busy === null && !err && <p className="mt-1 text-[11px] text-ink-400">Loading availability…</p>}
          <div className="mt-2 flex gap-3 text-[10px] text-ink-400">
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-50 ring-1 ring-emerald-200" /> free</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-rose-100" /> busy</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-ink-100" /> weekend</span>
          </div>
        </div>

        <div className="lg:border-l lg:border-ink-100 lg:pl-4">
          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-ink-400">Upcoming</p>
          {events === null ? (
            <p className="text-[11px] text-ink-400">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-[11px] text-ink-400">Nothing scheduled in the window.</p>
          ) : (
            <ul className="space-y-1.5">
              {events.slice(0, 6).map(ev => {
                const dt = new Date(ev.start);
                const when = ev.allDay
                  ? dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  : dt.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
                return (
                  <li key={ev.id} className="text-[11px] leading-tight">
                    <a href={ev.htmlLink} target="_blank" rel="noreferrer" className="font-medium text-ink-800 hover:underline">
                      {ev.summary}
                    </a>
                    <span className="block text-ink-400">{when}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function CalendarSection({
  lead,
  calToken,
  onConnectCal,
  onPatch
}: {
  lead: WorkshopLead;
  calToken: CalToken | null;
  onConnectCal: () => Promise<CalToken | null>;
  onPatch: (id: string, p: Partial<WorkshopLead>) => void;
}) {
  const [busy, setBusy] = useState<BusyInterval[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!calToken) {
      setBusy(null);
      return;
    }
    let cancelled = false;
    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + AVAIL_DAYS);
    getBusy(calToken.accessToken, now, end)
      .then(b => !cancelled && setBusy(b))
      .catch(
        e =>
          !cancelled &&
          setErr(isCalAuthError(e) ? 'Calendar access expired — reconnect.' : e instanceof Error ? e.message : 'Could not load availability.')
      );
    return () => {
      cancelled = true;
    };
  }, [calToken]);

  if (!calToken) {
    return (
      <Field label="Google Calendar">
        <button
          type="button"
          onClick={() => onConnectCal()}
          className="rounded border border-ink-200 bg-white px-2.5 py-1 text-xs text-ink-700 hover:bg-ink-50"
        >
          Connect to plan dates
        </button>
        <p className="mt-1 text-[11px] text-ink-400">See your availability and push recce / workshop dates to your calendar.</p>
      </Field>
    );
  }

  // Mark a day busy if any busy interval overlaps its 09:00–18:00 window.
  const busyDays = new Set<string>();
  if (busy) {
    for (const b of busy) {
      const s = new Date(b.start);
      const e = new Date(b.end);
      const cur = new Date(s);
      cur.setHours(0, 0, 0, 0);
      while (cur <= e) {
        const winStart = new Date(cur);
        winStart.setHours(9, 0, 0, 0);
        const winEnd = new Date(cur);
        winEnd.setHours(18, 0, 0, 0);
        if (s < winEnd && e > winStart) busyDays.add(dayKey(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }
  }

  const days: Date[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < AVAIL_DAYS; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  return (
    <Field label="Google Calendar">
      {err && <p className="mb-2 text-[11px] text-rose-600">{err}</p>}
      <p className="mb-1 text-[10px] uppercase tracking-wide text-ink-400">Next {AVAIL_DAYS} days · daytime availability</p>
      <div className="flex flex-wrap gap-1">
        {days.map(d => {
          const isBusy = busyDays.has(dayKey(d));
          const weekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <div
              key={dayKey(d)}
              title={`${d.toDateString()} — ${isBusy ? 'busy' : weekend ? 'weekend' : 'free'}`}
              className={`flex h-9 w-8 flex-col items-center justify-center rounded text-[9px] ${
                isBusy
                  ? 'bg-rose-100 text-rose-700'
                  : weekend
                    ? 'bg-ink-100 text-ink-400'
                    : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <span>{['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]}</span>
              <span className="font-medium">{d.getDate()}</span>
            </div>
          );
        })}
      </div>
      {busy === null && !err && <p className="mt-1 text-[11px] text-ink-400">Loading availability…</p>}

      <div className="mt-3 space-y-3">
        <ScheduleRow
          label="Recce day"
          summary={`Recce — ${lead.company || lead.person || 'lead'}`}
          location={lead.recce?.location}
          existing={lead.recceEvent}
          calToken={calToken}
          onConnectCal={onConnectCal}
          onScheduled={(ev, startIso) => onPatch(lead.id, { recceEvent: ev, recce: { ...(lead.recce ?? {}), date: startIso } })}
        />
        {lead.billing === 'paid' && (
          <ScheduleRow
            label="Build day"
            summary={`Workshop — ${lead.company || lead.person || 'lead'}`}
            location={lead.recce?.location}
            existing={lead.workshopEvent}
            calToken={calToken}
            onConnectCal={onConnectCal}
            onScheduled={(ev, startIso) => onPatch(lead.id, { workshopEvent: ev, workshopDate: startIso })}
          />
        )}
      </div>
    </Field>
  );
}

function ScheduleRow({
  label,
  summary,
  location,
  existing,
  calToken,
  onConnectCal,
  onScheduled
}: {
  label: string;
  summary: string;
  location?: string;
  existing?: WorkshopLead['recceEvent'];
  calToken: CalToken;
  onConnectCal: () => Promise<CalToken | null>;
  onScheduled: (ev: { id: string; htmlLink: string; start: string }, startLabel: string) => void;
}) {
  const [slot, setSlot] = useState(defaultSlot());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    setSaving(true);
    setErr(null);
    const startDate = new Date(slot);
    if (Number.isNaN(startDate.getTime())) {
      setErr('Pick a date/time first.');
      setSaving(false);
      return;
    }
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + DEFAULT_DURATION_HOURS);
    let token: CalToken | null = calToken;
    try {
      const run = async (t: string) =>
        insertEvent(t, { summary, location, start: startDate, end: endDate, description: 'Created from the Workshop Leads dashboard.' });
      let ev;
      try {
        ev = await run(token.accessToken);
      } catch (e) {
        if (isCalAuthError(e)) {
          token = await onConnectCal();
          if (!token) throw new Error('Reconnect cancelled.');
          ev = await run(token.accessToken);
        } else throw e;
      }
      const label = startDate.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
      onScheduled({ id: ev.id, htmlLink: ev.htmlLink, start: label }, label);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add event.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded border border-ink-200 bg-white p-2">
      <p className="mb-1 text-[11px] font-medium text-ink-700">{label}</p>
      {existing ? (
        <p className="text-[11px] text-emerald-700">
          ✓ On calendar ·{' '}
          <a href={existing.htmlLink} target="_blank" rel="noreferrer" className="underline">
            view event
          </a>{' '}
          <span className="text-ink-400">({existing.start})</span>
        </p>
      ) : null}
      <div className="mt-1 flex items-center gap-2">
        <input
          type="datetime-local"
          value={slot}
          onChange={e => setSlot(e.target.value)}
          className="rounded border border-ink-200 bg-white px-1.5 py-1 text-[11px] text-ink-700"
        />
        <button
          type="button"
          onClick={add}
          disabled={saving}
          className="rounded bg-accent px-2 py-1 text-[11px] font-medium text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {saving ? 'Adding…' : existing ? 'Re-add' : '+ Calendar'}
        </button>
      </div>
      <p className="mt-1 text-[10px] text-ink-400">{DEFAULT_DURATION_HOURS}h on-site block</p>
      {err && <p className="mt-1 text-[11px] text-rose-600">{err}</p>}
    </div>
  );
}

// ===========================================================================
// Engagement email template
// ===========================================================================

function buildEngagementEmail(lead: WorkshopLead): string {
  const first = (lead.person || 'there').split(' ')[0];
  const company = lead.company || 'your team';
  const date = lead.recce?.date || '[recce date]';
  const loc = lead.recce?.location || `${company}’s office`;
  return `Subject: Looking forward to our day at ${company}

Hi ${first},

Thanks again for the time on our call — really looking forward to spending a day inside ${company}.

Quick recap of how this works so we get the most out of it:

• I’ll come to ${loc} on ${date} for a recce day — sitting with how things actually run, pulling out the real detail (systems, spreadsheets, the workarounds and quiet friction) that makes what we build genuinely useful rather than generic.
• The one thing I need: one senior person with me throughout. Without their insight the tools we build won’t be valuable, and that part can’t be outsourced.
• We build on your machine with your API keys and your database — so you own everything from minute one. Teaching your team to fish, not selling fish.
• If it’s helpful, share any context beforehand (documents, ERP access, sample data). I prep either way, but it makes the day far more specific.

A couple of housekeeping notes: I’ll be ready to start on the dot, and the start/end times are fixed in advance. ₹1 lakh per day, paid same-day. Happy to sign an NDA if you’d like.

Anything you’d want me to look at first — just send it over.

Best,
Rhea`;
}

function EngagementEmail({ lead }: { lead: WorkshopLead }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => buildEngagementEmail(lead), [lead]);
  return (
    <Field label="Engagement email (pre-recce)">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="rounded border border-ink-200 bg-white px-2.5 py-1 text-xs text-ink-700 hover:bg-ink-50"
        >
          {open ? 'Hide draft' : 'Show draft'}
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* ignore */
            }
          }}
          className="rounded bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-600"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {open && (
        <textarea
          readOnly
          value={text}
          className="mt-2 h-56 w-full rounded border border-ink-200 bg-white px-2 py-1.5 font-mono text-[11px] leading-relaxed text-ink-700"
        />
      )}
    </Field>
  );
}

// ===========================================================================
// Small UI primitives
// ===========================================================================

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Workshop Leads</h1>
      <p className="mt-1 text-sm text-ink-500">
        Personal pipeline for the AI workshop business — from first DM to paid build day, plus org talks and job
        connects.
      </p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function ProgressBar({
  buckets,
  target
}: {
  buckets: ReturnType<typeof revenueBuckets>;
  target: number;
}) {
  // Scale the bar to whichever is larger — the target or the full pipeline —
  // so segments stay proportional even when we overshoot. The goal marker then
  // sits part-way along the bar instead of always at the right edge.
  const denom = Math.max(target, buckets.pipeline, 1);
  const w = (n: number) => `${(n / denom) * 100}%`;
  const targetPct = Math.min(100, (target / denom) * 100);
  const over = buckets.pipeline > target;
  const reached = Math.round((buckets.pipeline / target) * 100);
  return (
    <div className="relative mt-7">
      {/* goal marker label */}
      <div
        className="absolute -top-5 flex -translate-x-1/2 flex-col items-center"
        style={{ left: `${targetPct}%` }}
      >
        <span className="whitespace-nowrap text-[10px] font-medium text-ink-600">▼ {formatLakh(target)} goal</span>
      </div>

      <div className="flex h-5 w-full overflow-hidden rounded-full bg-ink-100">
        <span style={{ width: w(buckets.banked) }} className="h-full bg-emerald-600" title={`Banked ${formatINR(buckets.banked)}`} />
        <span style={{ width: w(buckets.hot) }} className="h-full bg-accent" title={`Hot ${formatINR(buckets.hot)}`} />
        <span style={{ width: w(buckets.warm) }} className="h-full bg-amber-400" title={`Warm ${formatINR(buckets.warm)}`} />
        <span style={{ width: w(buckets.cold) }} className="h-full bg-ink-300" title={`Cold ${formatINR(buckets.cold)}`} />
      </div>

      {/* goal marker line — overlaid, not clipped by the bar's rounded mask */}
      <div
        className="pointer-events-none absolute top-0 h-5 w-px bg-ink-900"
        style={{ left: `${targetPct}%` }}
      />

      <p className="mt-1.5 text-[11px] text-ink-400">
        {formatINR(buckets.pipeline)} of {formatINR(target)} in pipeline · {reached}%
        {over && <span className="font-medium text-emerald-700"> — {formatINR(buckets.pipeline - target)} over target 🎉</span>}
      </p>
    </div>
  );
}

function Legend({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
      {label} <span className="font-medium text-ink-800">{formatINR(value)}</span>
    </span>
  );
}

function GoalCard({ title, body, stat }: { title: string; body: string; stat?: string }) {
  return (
    <div className="rounded-md border border-ink-200 bg-white px-4 py-3">
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">{body}</p>
      {stat && <p className="mt-2 text-[11px] font-medium text-accent">{stat}</p>}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-ink-200 bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-ink-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold text-ink-900">{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-ink-400">{sub}</p>}
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-medium ${
        active ? 'bg-accent text-white' : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</p>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5 text-xs text-ink-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-ink-300 text-accent focus:ring-accent"
      />
      <span className={checked ? 'text-ink-400 line-through' : ''}>{label}</span>
    </label>
  );
}

function LabeledInput({
  label,
  value,
  onSave
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
}) {
  return (
    <label className="mt-2 block">
      <span className="text-[10px] uppercase tracking-wide text-ink-400">{label}</span>
      <input
        type="text"
        defaultValue={value}
        onBlur={e => e.target.value !== value && onSave(e.target.value)}
        className="mt-0.5 w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs text-ink-800"
      />
    </label>
  );
}

/** Inline text that commits on blur / Enter. Renders as plain text until focused-feel via input. */
function InlineText({
  value,
  placeholder,
  className = '',
  onSave
}: {
  value: string;
  placeholder?: string;
  className?: string;
  onSave: (v: string) => void;
}) {
  return (
    <input
      type="text"
      defaultValue={value}
      placeholder={placeholder}
      onBlur={e => e.target.value !== value && onSave(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={`w-full max-w-full rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-ink-200 focus:border-ink-300 focus:bg-white focus:outline-none ${className}`}
    />
  );
}

/** Date picker for the leads table. Stores an ISO `YYYY-MM-DD` string. */
function InlineDate({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
  return (
    <input
      type="date"
      value={valid}
      onChange={e => e.target.value !== value && onSave(e.target.value)}
      className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-ink-700 hover:border-ink-200 focus:border-ink-300 focus:bg-white focus:outline-none"
    />
  );
}

function NumberInput({
  value,
  step = 1,
  className = '',
  onSave
}: {
  value: number;
  step?: number;
  className?: string;
  onSave: (v: number) => void;
}) {
  return (
    <input
      type="number"
      defaultValue={value}
      step={step}
      min={0}
      onBlur={e => {
        const n = Number(e.target.value);
        if (!Number.isNaN(n) && n !== value) onSave(n);
      }}
      className={`rounded border border-ink-200 bg-white px-2 py-1 text-sm text-ink-800 ${className}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Next-steps history — the conversion-cycle log. Click ⏱ to see how this
// lead's next steps (and stage) evolved over time.
// ---------------------------------------------------------------------------

interface HistoryEntry {
  id: string;
  field: string;
  value: string;
  previous: string | null;
  at: number;
}

function NextStepsHistory({ leadId }: { leadId: string }) {
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && entries === null) {
      const token = await getToken();
      const res = await fetch(`/api/leads/${leadId}/history`, {
        headers: token ? { authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setEntries(((await res.json()) as { history: HistoryEntry[] }).history);
      } else {
        setEntries([]);
      }
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        className="rounded px-1 text-[11px] text-ink-300 hover:bg-ink-50 hover:text-ink-600"
        title="History of updates"
      >
        ⏱
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-30 max-h-64 w-72 overflow-y-auto rounded-lg border border-ink-200 bg-white p-3 shadow-lg">
          <p className="eyebrow mb-2">Update history</p>
          {entries === null ? (
            <p className="text-xs text-ink-400">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-xs text-ink-400">No logged changes yet — history starts now.</p>
          ) : (
            <ol className="space-y-2">
              {entries.map(e => (
                <li key={e.id} className="border-l-2 border-ink-100 pl-2">
                  <p className="text-[10px] text-ink-400">
                    {new Date(e.at).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}{' '}
                    · {e.field}
                  </p>
                  <p className="text-xs text-ink-700">{String(e.value)}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar ↔ lead sync — Rhea often books recces/workshops straight in Google
// Calendar. Scan the next 30 days, match event titles against lead names, and
// suggest writing the date back to the lead so everything stays synced.
// ---------------------------------------------------------------------------

function CalendarLeadSync({
  calToken,
  leads,
  onPatch
}: {
  calToken: CalToken;
  leads: WorkshopLead[];
  onPatch: (id: string, partial: Partial<WorkshopLead>) => void;
}) {
  const [suggestions, setSuggestions] = useState<
    { key: string; leadId: string; label: string; event: CalEvent; date: string; kind: 'recce' | 'workshop' }[]
  >([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const events = await listUpcomingEvents(calToken.accessToken, now, new Date(now.getTime() + 30 * 86400_000), 50);
        const found: typeof suggestions = [];
        for (const ev of events) {
          const title = ev.summary?.toLowerCase() ?? '';
          if (!title) continue;
          for (const l of leads) {
            const names = [l.person?.split(' ')[0], l.person, l.company].filter(
              (n): n is string => !!n && n.trim().length >= 3
            );
            if (!names.some(n => title.includes(n.toLowerCase()))) continue;
            const date = ev.start.slice(0, 10);
            const isRecce = /recce|visit|office/.test(title);
            const kind: 'recce' | 'workshop' = isRecce ? 'recce' : 'workshop';
            const current = isRecce ? l.recce?.date : l.workshopDate;
            if (current === date) continue; // already synced
            found.push({
              key: `${l.id}-${ev.id}`,
              leadId: l.id,
              label: [l.person, l.company].filter(Boolean).join(' · '),
              event: ev,
              date,
              kind
            });
          }
        }
        // One suggestion per lead+event; cap the strip.
        setSuggestions(found.slice(0, 4));
      } catch {
        // calendar hiccups are non-fatal
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calToken.accessToken]);

  const visible = suggestions.filter(s => !dismissed.has(s.key));
  if (visible.length === 0) return null;

  return (
    <div className="mt-3 space-y-1.5">
      {visible.map(s => (
        <div
          key={s.key}
          className="flex flex-wrap items-center gap-2 rounded-md border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-900"
        >
          <span>
            📅 “{s.event.summary}” on{' '}
            {new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} looks like{' '}
            <strong>{s.label}</strong> — set as {s.kind === 'recce' ? 'recce' : 'workshop'} date?
          </span>
          <span className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (s.kind === 'recce') {
                  const lead = leads.find(l => l.id === s.leadId);
                  onPatch(s.leadId, { recce: { ...(lead?.recce ?? {}), date: s.date } });
                } else {
                  onPatch(s.leadId, { workshopDate: s.date });
                }
                setDismissed(prev => new Set([...prev, s.key]));
              }}
              className="rounded bg-indigo-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-indigo-700"
            >
              Sync it
            </button>
            <button
              type="button"
              onClick={() => setDismissed(prev => new Set([...prev, s.key]))}
              className="text-[11px] text-indigo-400 hover:text-indigo-700"
            >
              dismiss
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
