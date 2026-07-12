'use client';

// Weekly team plans. Each teammate keeps a rough plan (typed, voice-noted, or
// day-wise), editable anytime; everyone sees everyone's so the team stays in
// sync. Rhai structures the rough text into days/dates, linked clients, and
// to-dos — client mentions resolve to pipeline leads you can click through to.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useAuthedFetch } from './useAuthedFetch';
import { useVoice } from './useVoice';
import { displayNameFor, isThisWeek, shiftWeekISO, weekLabel, weekStartISO, type PlanStructure, type WeekPlan } from '@/lib/rhai/plans';

export function PlansPanel() {
  const { user } = useAuth();
  const authedFetch = useAuthedFetch();
  const [week, setWeek] = useState(() => weekStartISO(Date.now()));
  const [me, setMe] = useState<string | null>(null);
  const [plans, setPlans] = useState<WeekPlan[] | null>(null);

  const load = useCallback(
    async (w: string) => {
      const res = await authedFetch(`/api/rhai/plans?week=${w}`);
      if (res.ok) {
        const d = (await res.json()) as { me: string; plans: WeekPlan[] };
        setMe(d.me);
        setPlans(d.plans);
      }
    },
    [authedFetch]
  );

  useEffect(() => {
    if (user) load(week).catch(() => undefined);
  }, [user, week, load]);

  const mine = plans?.find(p => p.ownerEmail === me) ?? null;
  const others = (plans ?? []).filter(p => p.ownerEmail !== me);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeek(w => shiftWeekISO(w, -1))}
            className="rounded-md border border-ink-200 px-2 py-1 text-sm text-ink-600 hover:bg-ink-50"
          >
            ‹
          </button>
          <span className="min-w-[170px] text-center text-sm font-medium text-ink-800">
            {weekLabel(week)} {isThisWeek(week, Date.now()) && <span className="text-accent">· this week</span>}
          </span>
          <button
            type="button"
            onClick={() => setWeek(w => shiftWeekISO(w, 1))}
            className="rounded-md border border-ink-200 px-2 py-1 text-sm text-ink-600 hover:bg-ink-50"
          >
            ›
          </button>
          {!isThisWeek(week, Date.now()) && (
            <button type="button" onClick={() => setWeek(weekStartISO(Date.now()))} className="text-[11px] text-accent hover:underline">
              today
            </button>
          )}
        </div>
      </div>

      {plans === null ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : (
        <div className="space-y-5">
          <MyPlan
            week={week}
            plan={mine}
            ownerName={user?.displayName ?? undefined}
            authedFetch={authedFetch}
            onChange={p => setPlans(prev => upsert(prev ?? [], p))}
          />
          <div>
            <p className="eyebrow mb-2">The rest of the team {others.length ? `· ${others.length}` : ''}</p>
            {others.length === 0 ? (
              <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-6 text-center text-sm text-ink-400">
                No one else has posted a plan for this week yet.
              </p>
            ) : (
              <div className="space-y-3">
                {others.map(p => (
                  <TeammatePlan key={p.id} plan={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function upsert(list: WeekPlan[], p: WeekPlan): WeekPlan[] {
  const i = list.findIndex(x => x.id === p.id);
  if (i === -1) return [p, ...list];
  const next = [...list];
  next[i] = p;
  return next;
}

function MyPlan({
  week,
  plan,
  ownerName,
  authedFetch,
  onChange
}: {
  week: string;
  plan: WeekPlan | null;
  ownerName?: string;
  authedFetch: (p: string, i?: RequestInit) => Promise<Response>;
  onChange: (p: WeekPlan) => void;
}) {
  const [raw, setRaw] = useState(plan?.raw ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [structuring, setStructuring] = useState(false);
  const [structure, setStructure] = useState<PlanStructure | undefined>(plan?.structure);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voice = useVoice(t => {
    setRaw(prev => {
      const next = prev ? `${prev}\n${t}` : t;
      save(next);
      return next;
    });
  });

  // Reset when switching weeks / when the loaded plan arrives.
  useEffect(() => {
    setRaw(plan?.raw ?? '');
    setStructure(plan?.structure);
  }, [plan?.id, plan?.raw, plan?.structure, week]);

  const save = useCallback(
    (value: string) => {
      setStatus('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const res = await authedFetch('/api/rhai/plans', {
          method: 'PUT',
          body: JSON.stringify({ week, raw: value, ownerName })
        });
        if (res.ok) {
          const { plan: saved } = (await res.json()) as { plan: WeekPlan };
          onChange(saved);
        }
        setStatus('saved');
      }, 900);
    },
    [authedFetch, week, ownerName, onChange]
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const structureNow = async () => {
    if (!raw.trim()) return;
    setStructuring(true);
    try {
      // Make sure the latest text is saved first.
      if (timer.current) clearTimeout(timer.current);
      await authedFetch('/api/rhai/plans', { method: 'PUT', body: JSON.stringify({ week, raw, ownerName }) });
      const res = await authedFetch('/api/rhai/plans/structure', { method: 'POST', body: JSON.stringify({ week }) });
      if (res.ok) setStructure(((await res.json()) as { structure: PlanStructure }).structure);
    } finally {
      setStructuring(false);
    }
  };

  return (
    <div className="rounded-lg border border-accent/30 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="eyebrow">Your plan</p>
        <span className="text-[10px] text-ink-400">{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}</span>
      </div>
      <textarea
        value={raw}
        onChange={e => {
          setRaw(e.target.value);
          save(e.target.value);
        }}
        rows={6}
        placeholder={'Rough is fine — "SRC recce Tue, draft Dodla proposal, Hang w AI Thu 6pm, follow up Bliss invoice". Type, paste, go day-wise, or use the mic.'}
        className="w-full resize-y rounded-md border border-ink-200 px-3 py-2 text-sm leading-relaxed focus:border-ink-400 focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {voice.supported && (
          <button
            type="button"
            onClick={voice.toggle}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              voice.listening ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-ink-200 text-ink-500 hover:bg-ink-50'
            }`}
            title="Add a voice note — it transcribes into your plan"
          >
            {voice.listening ? '● recording' : '🎙 voice note'}
          </button>
        )}
        <button
          type="button"
          onClick={structureNow}
          disabled={structuring || !raw.trim()}
          className="ml-auto rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-600 disabled:opacity-50"
        >
          {structuring ? 'Rhai is reading…' : structure ? '↻ Re-structure' : '✨ Rhai, structure this'}
        </button>
      </div>
      {voice.error && <p className="mt-1 text-[11px] text-rose-600">{voice.error}</p>}

      {structure && <StructuredView structure={structure} />}
    </div>
  );
}

function TeammatePlan({ plan }: { plan: WeekPlan }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between text-left">
        <span className="text-sm font-semibold text-ink-900">{displayNameFor(plan.ownerEmail, plan.ownerName)}</span>
        <span className="text-[10px] text-ink-400">
          updated {new Date(plan.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {open ? '▾' : '▸'}
        </span>
      </button>
      {open &&
        (plan.structure ? (
          <StructuredView structure={plan.structure} />
        ) : plan.raw.trim() ? (
          <p className="mt-2 whitespace-pre-wrap rounded-md bg-cream-50 p-3 text-[13px] leading-relaxed text-ink-700">{plan.raw}</p>
        ) : (
          <p className="mt-2 text-[12px] text-ink-400">Empty.</p>
        ))}
    </div>
  );
}

function StructuredView({ structure }: { structure: PlanStructure }) {
  return (
    <div className="mt-3 space-y-3 border-t border-ink-100 pt-3">
      {structure.summary && <p className="text-[13px] italic leading-relaxed text-ink-600">{structure.summary}</p>}

      {structure.days.length > 0 && (
        <div className="space-y-2">
          {structure.days.map((d, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-24 shrink-0">
                <p className="text-xs font-semibold text-ink-900">{d.day}</p>
                {d.date && <p className="text-[10px] text-ink-400">{new Date(`${d.date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</p>}
              </div>
              <ul className="flex-1 space-y-1">
                {d.items.map((it, j) => (
                  <li key={j} className="text-[13px] text-ink-800">
                    {it.time && <span className="text-ink-400">{it.time} · </span>}
                    {it.text}
                    <LeadTag leadId={it.leadId} leadLabel={it.leadLabel} client={it.client} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {structure.todos.length > 0 && (
        <div>
          <p className="eyebrow mb-1">To do</p>
          <ul className="space-y-1">
            {structure.todos.map((it, i) => (
              <li key={i} className="text-[13px] text-ink-800">
                • {it.text}
                {it.date && <span className="text-ink-400"> · {new Date(`${it.date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>}
                <LeadTag leadId={it.leadId} leadLabel={it.leadLabel} client={it.client} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {structure.clients.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {structure.clients.map((c, i) =>
            c.leadId ? (
              <a key={i} href={`/leads/${c.leadId}`} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-accent hover:underline">
                {c.leadLabel ?? c.name} ↗
              </a>
            ) : (
              <span key={i} className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] text-ink-500">
                {c.name}
              </span>
            )
          )}
        </div>
      )}
    </div>
  );
}

function LeadTag({ leadId, leadLabel, client }: { leadId?: string; leadLabel?: string; client?: string }) {
  if (leadId)
    return (
      <a href={`/leads/${leadId}`} className="ml-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent hover:underline">
        {leadLabel ?? client ?? 'lead'} ↗
      </a>
    );
  if (client) return <span className="ml-1.5 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500">{client}</span>;
  return null;
}
