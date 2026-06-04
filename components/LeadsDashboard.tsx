'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthProvider';
import {
  type CalToken,
  type BusyInterval,
  connectGoogleCalendar,
  getBusy,
  insertEvent,
  isCalAuthError,
  loadToken
} from '@/lib/leads/calendar';
import {
  DAY_RATE_INR,
  JUNE_TARGET_INR,
  LIKELIHOOD_LABELS,
  STAGE_LABELS,
  STAGE_ORDER,
  TYPE_LABELS,
  formatINR,
  formatLakh,
  leadValue,
  revenueBuckets,
  type Likelihood,
  type LeadStage,
  type LeadType,
  type WorkshopLead
} from '@/lib/leads/types';

// Stages that make sense for top-of-funnel (org / free) rows.
const OUTREACH_STAGES: LeadStage[] = [
  'interested',
  'discovery_call',
  'workshop_scheduled',
  'delivered',
  'closed',
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
        setLeads(d.leads);
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
        body: JSON.stringify({ person: '', company: '', type: 'paid', stage: 'interested' })
      });
      const d = (await res.json()) as { lead: WorkshopLead };
      setLeads(prev => (prev ? [d.lead, ...prev] : [d.lead]));
      setExpanded(d.lead.id);
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

  const all = leads ?? [];
  const visible = filter === 'all' ? all : all.filter(l => l.type === filter);
  const buckets = revenueBuckets(all);
  const jobConnects = all.filter(l => l.jobConnect);
  const orgScheduled = all.filter(l => l.type === 'org_session' && l.stage !== 'interested' && l.stage !== 'lost');
  const paidWon = all.filter(l => l.type === 'paid' && (l.paymentReceived || l.stage === 'paid' || l.stage === 'closed'));

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
            {(['paid', 'org_session', 'free_session'] as LeadType[]).map(t => (
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
          <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-200 bg-ink-50 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="py-2 pl-4 pr-3">Date</th>
                  <th className="py-2 pr-3">Person · Company</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Stage</th>
                  <th className="py-2 pr-3">Strength</th>
                  <th className="py-2 pr-3">Next step</th>
                  <th className="py-2 pr-3 text-right">Est. value</th>
                  <th className="py-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {visible.map(l => (
                  <LeadRow
                    key={l.id}
                    lead={l}
                    expanded={expanded === l.id}
                    onToggle={() => setExpanded(expanded === l.id ? null : l.id)}
                    onPatch={patch}
                    onDelete={removeLead}
                    calToken={calToken}
                    onConnectCal={connectCal}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Wrapper>
  );
}

// ===========================================================================
// Row + expandable editor
// ===========================================================================

function LeadRow({
  lead,
  expanded,
  onToggle,
  onPatch,
  onDelete,
  calToken,
  onConnectCal
}: {
  lead: WorkshopLead;
  expanded: boolean;
  onToggle: () => void;
  onPatch: (id: string, p: Partial<WorkshopLead>) => void;
  onDelete: (id: string) => void;
  calToken: CalToken | null;
  onConnectCal: () => Promise<CalToken | null>;
}) {
  const value = leadValue(lead);
  const stages = lead.type === 'paid' ? STAGE_ORDER : OUTREACH_STAGES;
  return (
    <>
      <tr className="border-b border-ink-100 align-top hover:bg-ink-50/60">
        <td className="py-2 pl-4 pr-3 text-xs text-ink-600">
          <InlineText value={lead.dateLabel} placeholder="—" onSave={v => onPatch(lead.id, { dateLabel: v })} />
        </td>
        <td className="py-2 pr-3">
          <div className="flex items-center gap-1.5">
            <InlineText
              value={lead.person}
              placeholder="Person"
              className="font-medium text-ink-900"
              onSave={v => onPatch(lead.id, { person: v })}
            />
            {lead.jobConnect && (
              <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-800">
                SF connect
              </span>
            )}
          </div>
          <InlineText
            value={lead.company}
            placeholder="Company"
            className="text-[11px] text-ink-500"
            onSave={v => onPatch(lead.id, { company: v })}
          />
        </td>
        <td className="py-2 pr-3">
          <select
            value={lead.type}
            onChange={e => onPatch(lead.id, { type: e.target.value as LeadType })}
            className="rounded border border-ink-200 bg-white px-1.5 py-1 text-xs text-ink-700"
          >
            {(['paid', 'org_session', 'free_session'] as LeadType[]).map(t => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </td>
        <td className="py-2 pr-3">
          <select
            value={lead.stage}
            onChange={e => onPatch(lead.id, { stage: e.target.value as LeadStage })}
            className="rounded border border-ink-200 bg-white px-1.5 py-1 text-xs text-ink-700"
          >
            {stages.map(s => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </td>
        <td className="py-2 pr-3">
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
        </td>
        <td className="py-2 pr-3 max-w-[220px]">
          <InlineText
            value={lead.nextSteps}
            placeholder="Next step…"
            className="text-xs text-ink-700"
            onSave={v => onPatch(lead.id, { nextSteps: v })}
          />
        </td>
        <td className="py-2 pr-3 text-right text-xs">
          {lead.type === 'paid' ? (
            <span className={lead.paymentReceived ? 'font-semibold text-emerald-700' : 'text-ink-700'}>
              {formatINR(value)}
            </span>
          ) : (
            <span className="text-ink-300">—</span>
          )}
        </td>
        <td className="py-2 pr-4 text-right">
          <button
            type="button"
            onClick={onToggle}
            className="rounded px-2 py-1 text-xs text-ink-500 hover:bg-ink-100"
          >
            {expanded ? 'Close' : 'Open'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-ink-100 bg-ink-50/40">
          <td colSpan={8} className="px-4 py-4">
            <LeadEditor
              lead={lead}
              onPatch={onPatch}
              onDelete={onDelete}
              calToken={calToken}
              onConnectCal={onConnectCal}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function LeadEditor({
  lead,
  onPatch,
  onDelete,
  calToken,
  onConnectCal
}: {
  lead: WorkshopLead;
  onPatch: (id: string, p: Partial<WorkshopLead>) => void;
  onDelete: (id: string) => void;
  calToken: CalToken | null;
  onConnectCal: () => Promise<CalToken | null>;
}) {
  const recce = lead.recce ?? {};
  const setRecce = (p: Partial<typeof recce>) => onPatch(lead.id, { recce: { ...recce, ...p } });
  const setCheck = (k: keyof WorkshopLead['checklist'], v: boolean) =>
    onPatch(lead.id, { checklist: { ...lead.checklist, [k]: v } });

  return (
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
        {lead.type === 'paid' && (
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
  const pct = (n: number) => `${Math.min(100, (n / target) * 100)}%`;
  const over = buckets.pipeline > target;
  return (
    <>
      <div className="mt-4 flex h-5 w-full overflow-hidden rounded-full bg-ink-100">
        <span style={{ width: pct(buckets.banked) }} className="h-full bg-emerald-600" title={`Banked ${formatINR(buckets.banked)}`} />
        <span style={{ width: pct(buckets.hot) }} className="h-full bg-accent" title={`Hot ${formatINR(buckets.hot)}`} />
        <span style={{ width: pct(buckets.warm) }} className="h-full bg-amber-400" title={`Warm ${formatINR(buckets.warm)}`} />
        <span style={{ width: pct(buckets.cold) }} className="h-full bg-ink-300" title={`Cold ${formatINR(buckets.cold)}`} />
      </div>
      <p className="mt-1 text-[11px] text-ink-400">
        {formatINR(buckets.pipeline)} of {formatINR(target)} in pipeline
        {over ? ' — over target 🎉' : ` · ${Math.round((buckets.pipeline / target) * 100)}%`}
      </p>
    </>
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
