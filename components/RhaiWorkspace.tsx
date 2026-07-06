'use client';

// The Rhai workspace — the surface where Rhea and her AI cofounder meet.
// Tabs: Pipeline (the existing LeadsDashboard) · Today (Rhai's proactive
// suggestions) · Ideas (scratchpad Rhai enriches) · Context (the vault) ·
// Skills (registry + default models). All operator-only.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { BriefingStrip } from './BriefingStrip';
import { LeadsDashboard } from './LeadsDashboard';
import { RhaiChat } from './RhaiChat';
import { InterviewsPanel } from './RhaiInterviews';
import { PeoplePanel, PersonDrawer } from './RhaiPeople';
import { TasksPanel } from './RhaiTasks';
import { TodosSection } from './RhaiTodos';
import { Tour } from './Tour/Tour';
import { RHAI_TOUR_STEPS } from './Tour/rhaiTourSteps';
import type { RhaiPerson } from '@/lib/rhai/types';
import {
  IDEA_STATUS_LABELS,
  MODEL_OPTIONS,
  SECTION_MODE,
  SUGGESTION_KIND_LABELS,
  type ContextSection,
  type RhaiIdea,
  type RhaiSkill,
  type RhaiSuggestion
} from '@/lib/rhai/types';

type Tab = 'pipeline' | 'today' | 'tasks' | 'people' | 'ideas' | 'interviews' | 'context' | 'skills';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'today', label: 'Today' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'people', label: 'People' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'interviews', label: 'Interviews' },
  { id: 'context', label: 'Context' },
  { id: 'skills', label: 'Skills' }
];

function useAuthedFetch() {
  const { getToken } = useAuth();
  return useCallback(
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
}

const TOUR_SEEN_KEY = 'rhai.tour.seen';

export function RhaiWorkspace() {
  const [tab, setTab] = useState<Tab>('pipeline');
  const [drawerPerson, setDrawerPerson] = useState<RhaiPerson | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const { user, getToken } = useAuth();

  // Auto-launch the onboarding tour once per user. Waits until they're
  // signed in and the UI has rendered so tour selectors resolve.
  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem(TOUR_SEEN_KEY)) return;
    const t = window.setTimeout(() => setTourOpen(true), 800);
    return () => window.clearTimeout(t);
  }, [user]);

  const closeTour = () => {
    setTourOpen(false);
    localStorage.setItem(TOUR_SEEN_KEY, '1');
  };

  // Any component can open a person drawer by name:
  // window.dispatchEvent(new CustomEvent('rhai:openPerson', { detail: { name } }))
  useEffect(() => {
    const onOpen = async (e: Event) => {
      const name = (e as CustomEvent<{ name?: string }>).detail?.name?.trim();
      if (!name) return;
      const token = await getToken();
      const headers = {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      };
      const res = await fetch('/api/rhai/people', { headers });
      if (!res.ok) return;
      const { people } = (await res.json()) as { people: RhaiPerson[] };
      const needle = name.toLowerCase();
      const found =
        people.find(p => p.name.toLowerCase() === needle) ??
        people.find(p => p.name.toLowerCase().includes(needle) || needle.includes(p.name.toLowerCase()));
      if (found) {
        setDrawerPerson(found);
      } else {
        const createRes = await fetch('/api/rhai/people', {
          method: 'POST',
          headers,
          body: JSON.stringify({ name })
        });
        if (createRes.ok) setDrawerPerson(((await createRes.json()) as { person: RhaiPerson }).person);
      }
    };
    window.addEventListener('rhai:openPerson', onOpen);
    return () => window.removeEventListener('rhai:openPerson', onOpen);
  }, [getToken]);

  return (
    <div>
      {/* Rhai's briefing — the first thing on the page, front and center. */}
      {tab === 'pipeline' && (
        <div data-tour="briefing">
          <BriefingStrip onOpenToday={() => setTab('today')} />
        </div>
      )}

      <div className="border-b border-ink-200/70 bg-cream-50/60">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-6">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              data-tour={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-accent text-ink-900'
                  : 'border-transparent text-ink-500 hover:text-ink-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'pipeline' && <LeadsDashboard />}
      {tab === 'today' && <TodayPanel />}
      {tab === 'tasks' && (
        <Panel
          title="Tasks"
          sub="Work assigned to Rhai — research runs, drafts, prep. Tasks carry the client's full context and run in parallel; results land back here."
        >
          <TasksPanel />
        </Panel>
      )}
      {tab === 'people' && (
        <Panel
          title="People"
          sub="Everyone in your orbit — leads, hosts, amplifiers, collaborators. Click anyone to see Rhai's profile, add context by voice or text, or send Rhai to research them."
        >
          <PeoplePanel onOpen={setDrawerPerson} />
        </Panel>
      )}
      {tab === 'ideas' && <IdeasPanel />}
      {tab === 'interviews' && (
        <Panel
          title="Interviews"
          sub="Rhai interviews candidates for you on a sandboxed public page — it knows only the role brief, nothing about the business. Transcripts, fit summaries, and their questions for you land here."
        >
          <InterviewsPanel />
        </Panel>
      )}
      {tab === 'context' && <ContextPanel />}
      {tab === 'skills' && <SkillsPanel />}

      {drawerPerson && <PersonDrawer person={drawerPerson} onClose={() => setDrawerPerson(null)} />}
      <RhaiChat />

      {/* Replay-the-tour pill — small so it's not in the way, always available. */}
      {user && (
        <button
          type="button"
          onClick={() => setTourOpen(true)}
          className="fixed left-4 bottom-4 z-30 rounded-full border border-ink-200 bg-white/90 px-3 py-1.5 text-[11px] text-ink-600 shadow-sm backdrop-blur hover:bg-white hover:text-ink-900"
          title="Walk through how Rhai works"
        >
          ✨ Take the tour
        </button>
      )}

      <Tour steps={RHAI_TOUR_STEPS} open={tourOpen} onClose={closeTour} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared shell for the Rhai tabs (sign-in gate + heading)
// ---------------------------------------------------------------------------

function Panel({
  title,
  sub,
  children
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  const { user, signIn } = useAuth();
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <p className="eyebrow">Rhai</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight text-ink-900">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-600">{sub}</p>
      <div className="mt-8">
        {user ? (
          children
        ) : (
          <button
            type="button"
            onClick={() => signIn().catch(() => undefined)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
          >
            Sign in with Google
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Today — Rhai's proactive cofounder pass
// ---------------------------------------------------------------------------

function TodayPanel() {
  const authedFetch = useAuthedFetch();
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<RhaiSuggestion[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authedFetch('/api/rhai/today');
    if (!res.ok) throw new Error(await res.text());
    const d = (await res.json()) as { suggestions: RhaiSuggestion[] };
    setSuggestions(d.suggestions);
  }, [authedFetch]);

  useEffect(() => {
    if (!user) return;
    load().catch(e => setErr(e instanceof Error ? e.message : 'load failed'));
  }, [user, load]);

  const generate = async () => {
    setGenerating(true);
    setErr(null);
    try {
      const res = await authedFetch('/api/rhai/today', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const setStatus = async (id: string, status: RhaiSuggestion['status']) => {
    setSuggestions(prev => (prev ? prev.map(s => (s.id === id ? { ...s, status } : s)) : prev));
    await authedFetch('/api/rhai/today', { method: 'PATCH', body: JSON.stringify({ id, status }) }).catch(
      () => undefined
    );
  };

  const proposed = (suggestions ?? []).filter(s => s.status === 'proposed');
  const approved = (suggestions ?? []).filter(s => s.status === 'approved');
  const done = (suggestions ?? [])
    .filter(s => s.status === 'done')
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const dismissed = (suggestions ?? [])
    .filter(s => s.status === 'dismissed')
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <Panel
      title="Rhai · Today"
      sub="Rhai reads your pipeline, smart notes, and parked ideas, then proposes the highest-leverage moves. Approve to queue for execution — nothing reaches a client without you."
    >
      <TodosSection />
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {generating ? 'Rhai is thinking…' : suggestions?.length ? '↻ Re-run the morning pass' : 'Run the morning pass'}
        </button>
        {err && <p className="text-xs text-rose-600">{err}</p>}
      </div>

      {suggestions === null ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : proposed.length === 0 && approved.length === 0 && done.length === 0 && dismissed.length === 0 ? (
        <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
          No suggestions yet — run the morning pass and Rhai will do a full read of the business.
        </p>
      ) : (
        <div className="space-y-6">
          {proposed.length > 0 && (
            <section>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Proposed · {proposed.length}
              </h2>
              <div className="space-y-2">
                {proposed.map(s => (
                  <SuggestionCard key={s.id} s={s} onStatus={setStatus} />
                ))}
              </div>
            </section>
          )}
          {approved.length > 0 && (
            <section>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Underway · {approved.length}
              </h2>
              <p className="mb-2 text-xs text-ink-400">
                Queued for your Claude Code hands — run{' '}
                <code className="rounded bg-ink-100 px-1">npm run rhai:intents</code> to drain the queue, or mark done
                here when they land.
              </p>
              <div className="space-y-2">
                {approved.map(s => (
                  <SuggestionCard key={s.id} s={s} onStatus={setStatus} />
                ))}
              </div>
            </section>
          )}
          {done.length > 0 && (
            <ArchiveSection title={`Done · ${done.length}`} tone="emerald" items={done} onStatus={setStatus} />
          )}
          {dismissed.length > 0 && (
            <ArchiveSection
              title={`Dismissed · ${dismissed.length}`}
              tone="muted"
              items={dismissed}
              onStatus={setStatus}
            />
          )}
        </div>
      )}
    </Panel>
  );
}

// Collapsed history of suggestions (done / dismissed). Momentum stays visible;
// nothing evaporates. "Undo" restores to proposed so it doesn't feel one-way.
function ArchiveSection({
  title,
  tone,
  items,
  onStatus
}: {
  title: string;
  tone: 'emerald' | 'muted';
  items: RhaiSuggestion[];
  onStatus: (id: string, status: RhaiSuggestion['status']) => void;
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, 3);
  const chipColor = tone === 'emerald' ? 'text-emerald-700' : 'text-ink-400';
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`mb-2 flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wider ${chipColor} hover:text-ink-900`}
      >
        <span>{title}</span>
        <span className="text-ink-400">{open ? '▾' : '▸'}</span>
      </button>
      <ol className="space-y-1.5">
        {shown.map(s => (
          <li key={s.id} className="flex items-start gap-2 rounded-md border border-ink-100 bg-white/60 px-3 py-2">
            <span className={`mt-0.5 text-[11px] ${chipColor}`}>{tone === 'emerald' ? '✓' : '—'}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-ink-700">{s.title}</span>
              {s.leadLabel && <span className="block text-[10px] text-ink-400">{s.leadLabel}</span>}
              <span className="block text-[10px] text-ink-400">
                {new Date(s.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onStatus(s.id, 'proposed')}
              className="text-[10px] text-ink-400 hover:text-ink-700"
              title="Bring back to proposed"
            >
              undo
            </button>
          </li>
        ))}
        {!open && items.length > 3 && (
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-[11px] text-ink-500 hover:underline"
            >
              Show {items.length - 3} more…
            </button>
          </li>
        )}
      </ol>
    </section>
  );
}

function SuggestionCard({
  s,
  onStatus
}: {
  s: RhaiSuggestion;
  onStatus: (id: string, status: RhaiSuggestion['status']) => void;
}) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
              {SUGGESTION_KIND_LABELS[s.kind]}
            </span>
            {s.leadLabel && <span className="text-[11px] text-ink-400">{s.leadLabel}</span>}
          </div>
          <p className="mt-1 text-sm font-semibold text-ink-900">{s.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink-600">{s.detail}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          {s.status === 'proposed' && (
            <>
              <button
                type="button"
                onClick={() => onStatus(s.id, 'approved')}
                className="rounded-md bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-200"
                title="Rhai (or you) is working on this"
              >
                ⟳ Underway
              </button>
              <button
                type="button"
                onClick={() => onStatus(s.id, 'done')}
                className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
              >
                ✓ Done
              </button>
              <button
                type="button"
                onClick={() => onStatus(s.id, 'dismissed')}
                className="rounded-md border border-ink-200 px-3 py-1 text-xs text-ink-500 hover:bg-ink-50"
              >
                Dismiss
              </button>
            </>
          )}
          {s.status === 'approved' && (
            <>
              <button
                type="button"
                onClick={() => onStatus(s.id, 'done')}
                className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
              >
                ✓ Mark done
              </button>
              <button
                type="button"
                onClick={() => onStatus(s.id, 'proposed')}
                className="rounded-md border border-ink-200 px-3 py-1 text-xs text-ink-500 hover:bg-ink-50"
                title="Move back to proposed"
              >
                Reopen
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ideas — the scratchpad
// ---------------------------------------------------------------------------

function IdeasPanel() {
  const authedFetch = useAuthedFetch();
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<RhaiIdea[] | null>(null);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const res = await authedFetch('/api/rhai/ideas');
      if (res.ok) setIdeas(((await res.json()) as { ideas: RhaiIdea[] }).ideas);
    })().catch(() => setErr('Could not load ideas'));
  }, [user, authedFetch]);

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const res = await authedFetch('/api/rhai/ideas', { method: 'POST', body: JSON.stringify({ text }) });
    if (res.ok) {
      const { idea } = (await res.json()) as { idea: RhaiIdea };
      setIdeas(prev => [idea, ...(prev ?? [])]);
    }
  };

  const patch = async (id: string, p: Partial<RhaiIdea>) => {
    setIdeas(prev => (prev ? prev.map(i => (i.id === id ? { ...i, ...p } : i)) : prev));
    await authedFetch(`/api/rhai/ideas/${id}`, { method: 'PATCH', body: JSON.stringify(p) }).catch(() => undefined);
  };

  const remove = async (id: string) => {
    setIdeas(prev => (prev ? prev.filter(i => i.id !== id) : prev));
    await authedFetch(`/api/rhai/ideas/${id}`, { method: 'DELETE' }).catch(() => undefined);
  };

  const enrich = async (id: string) => {
    setIdeas(prev => (prev ? prev.map(i => (i.id === id ? { ...i, status: 'researching' } : i)) : prev));
    try {
      const res = await authedFetch(`/api/rhai/ideas/${id}/enrich`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      const { idea } = (await res.json()) as { idea: RhaiIdea };
      setIdeas(prev => (prev ? prev.map(i => (i.id === id ? idea : i)) : prev));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Enrichment failed');
      setIdeas(prev => (prev ? prev.map(i => (i.id === id ? { ...i, status: 'parked' } : i)) : prev));
    }
  };

  return (
    <Panel
      title="Ideas"
      sub={'Park rough thoughts — "should ask Aishwarya if we can do this with her school." Rhai researches the people and orgs, brainstorms the play, and asks what it needs to know.'}
    >
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Park an idea…"
          className="flex-1 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 focus:border-ink-300 focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
        >
          + Park it
        </button>
      </div>
      {err && <p className="mb-3 text-xs text-rose-600">{err}</p>}

      {ideas === null ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : ideas.length === 0 ? (
        <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
          Nothing parked yet.
        </p>
      ) : (
        <IdeasList ideas={ideas} onPatch={patch} onDelete={remove} onEnrich={enrich} />
      )}
    </Panel>
  );
}

// Active ideas up top; promoted/dropped collapse into an archive so nothing
// disappears — you can see the trail from parked → promoted-to-lead.
function IdeasList({
  ideas,
  onPatch,
  onDelete,
  onEnrich
}: {
  ideas: RhaiIdea[];
  onPatch: (id: string, p: Partial<RhaiIdea>) => void;
  onDelete: (id: string) => void;
  onEnrich: (id: string) => void;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const active = ideas.filter(i => i.status !== 'promoted' && i.status !== 'dropped');
  const archived = ideas
    .filter(i => i.status === 'promoted' || i.status === 'dropped')
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="space-y-3">
      {active.map(i => (
        <IdeaCard key={i.id} idea={i} onPatch={onPatch} onDelete={onDelete} onEnrich={onEnrich} />
      ))}

      {archived.length > 0 && (
        <section className="pt-3">
          <button
            type="button"
            onClick={() => setArchiveOpen(o => !o)}
            className="mb-2 flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-900"
          >
            <span>Archive · {archived.length}</span>
            <span className="text-ink-400">{archiveOpen ? '▾' : '▸'}</span>
          </button>
          {archiveOpen && (
            <ol className="space-y-1.5">
              {archived.map(i => (
                <li key={i.id} className="flex items-start gap-2 rounded-md border border-ink-100 bg-white/60 px-3 py-2">
                  <span className="mt-0.5 text-[10px]">
                    {i.status === 'promoted' ? (
                      <span className="text-indigo-600">↗</span>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-ink-700">{i.text}</span>
                    <span className="block text-[10px] text-ink-400">
                      {i.status === 'promoted' && i.leadId ? (
                        <>
                          Promoted to{' '}
                          <a href={`/leads/${i.leadId}`} className="text-indigo-600 underline">
                            {i.leadLabel ?? 'lead'}
                          </a>{' '}
                          ·{' '}
                        </>
                      ) : null}
                      {new Date(i.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onPatch(i.id, { status: 'parked' })}
                    className="text-[10px] text-ink-400 hover:text-ink-700"
                    title="Bring back to active"
                  >
                    undo
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}

function IdeaCard({
  idea,
  onPatch,
  onDelete,
  onEnrich
}: {
  idea: RhaiIdea;
  onPatch: (id: string, p: Partial<RhaiIdea>) => void;
  onDelete: (id: string) => void;
  onEnrich: (id: string) => void;
}) {
  const authedFetch = useAuthedFetch();
  const [answer, setAnswer] = useState('');
  const [promoting, setPromoting] = useState(false);
  const [candidates, setCandidates] = useState<{ leadId: string; label: string }[] | null>(null);
  const [promoted, setPromoted] = useState<{ leadId: string; leadLabel: string; tasks: number } | null>(
    idea.leadId ? { leadId: idea.leadId, leadLabel: idea.leadLabel ?? 'lead', tasks: 0 } : null
  );
  const busy = idea.status === 'researching';

  const promote = async (leadId?: string) => {
    setPromoting(true);
    setCandidates(null);
    try {
      const res = await authedFetch(`/api/rhai/ideas/${idea.id}/promote`, {
        method: 'POST',
        body: JSON.stringify(leadId ? { leadId } : {})
      });
      if (!res.ok) return;
      const d = (await res.json()) as {
        needsPick?: boolean;
        candidates?: { leadId: string; label: string }[];
        leadId?: string;
        leadLabel?: string;
        tasksCreated?: { id: string; title: string }[];
      };
      if (d.needsPick && d.candidates) {
        setCandidates(d.candidates);
        return;
      }
      if (d.leadId) {
        setPromoted({ leadId: d.leadId, leadLabel: d.leadLabel ?? 'lead', tasks: d.tasksCreated?.length ?? 0 });
        onPatch(idea.id, { status: 'promoted', leadId: d.leadId, leadLabel: d.leadLabel });
      }
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                idea.status === 'brainstormed'
                  ? 'bg-emerald-50 text-emerald-700'
                  : idea.status === 'researching'
                    ? 'bg-amber-50 text-amber-700'
                    : idea.status === 'promoted'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'bg-ink-100 text-ink-500'
              }`}
            >
              {IDEA_STATUS_LABELS[idea.status]}
            </span>
            <span className="text-[10px] text-ink-400">
              {new Date(idea.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-900">{idea.text}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => onEnrich(idea.id)}
            disabled={busy}
            className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-60"
          >
            {busy ? 'Researching…' : idea.enrichment ? '↻ Re-run' : '✨ Rhai, look into this'}
          </button>
          <button
            type="button"
            onClick={() => onDelete(idea.id)}
            className="rounded-md px-2 py-1 text-xs text-ink-400 hover:bg-rose-50 hover:text-rose-600"
          >
            ✕
          </button>
        </div>
      </div>

      {idea.enrichment && (
        <div className="mt-3 whitespace-pre-wrap rounded-md border border-ink-100 bg-ink-50/50 px-3 py-2 text-xs leading-relaxed text-ink-700">
          {idea.enrichment}
        </div>
      )}

      {idea.questions && idea.questions.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Rhai asks</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-ink-700">
            {idea.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Answer / add context (e.g. she's Aishwarya DKS Hegde, runs …)"
              className="flex-1 rounded border border-ink-200 bg-white px-2 py-1.5 text-xs text-ink-800 focus:border-ink-300 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (!answer.trim()) return;
                const merged = `${idea.extraContext ? idea.extraContext + '\n' : ''}${answer.trim()}`;
                onPatch(idea.id, { extraContext: merged });
                setAnswer('');
              }}
              className="rounded border border-ink-200 px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-50"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {idea.extraContext && (
        <p className="mt-2 text-[11px] text-ink-400">
          Context added: <span className="text-ink-600">{idea.extraContext}</span>
        </p>
      )}

      {candidates && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2">
          <p className="text-[11px] text-amber-800">Which lead is this about?</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {candidates.map(c => (
              <button
                key={c.leadId}
                type="button"
                onClick={() => promote(c.leadId)}
                className="rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-[11px] text-amber-900 hover:bg-amber-100"
              >
                {c.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCandidates(null)}
              className="px-2 text-[11px] text-amber-600 hover:underline"
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {promoted && (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
          ✓ On the pipeline as{' '}
          <a href={`/leads/${promoted.leadId}`} className="font-semibold underline">
            {promoted.leadLabel}
          </a>
          {promoted.tasks > 0 && <> · {promoted.tasks} task{promoted.tasks === 1 ? '' : 's'} queued for Rhai (see Tasks tab)</>}
          {' '}— brainstorm &amp; questions are in the lead&apos;s notes.
        </p>
      )}

      {(idea.status === 'brainstormed' || idea.status === 'parked') && !promoted && (
        <div className="mt-3 flex gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => promote()}
            disabled={promoting}
            className="text-indigo-700 hover:underline disabled:opacity-50"
          >
            {promoting ? 'Promoting…' : 'Promote to lead →'}
          </button>
          <button type="button" onClick={() => onPatch(idea.id, { status: 'dropped' })} className="text-ink-400 hover:underline">
            Drop
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context vault
// ---------------------------------------------------------------------------

const CONTEXT_HINTS: Record<string, string> = {
  about: 'Who you are, your story, credibility, how you work, what you want. Rhai leads every draft with this.',
  networks: 'Orgs & groups you can tap — Hang with AI, CREDAI, YPO, EO, FICCI FLO, school networks, alumni… who runs them, what a session there looks like.',
  thinking: 'Your philosophy on AI, dashboards, trust, ownership — so Rhai proposes things the way YOU would.',
  demos: 'Projects you can show as demos (Hoovu dashboard, AI CMO, Throughline, Vanaja…) — what each proves, when to pull it out.',
  templates: 'Email tone rules, invoice terms, anything Rhai must respect when drafting comms.',
  community:
    'Who’s in the Hang w AI orbit — leads, hosts, amplifiers, collaborators. Rhai mines this for follow-ups and network plays. Bulk-update via `npm run rhai:context -- community <file>`.',
  teaching:
    'Distilled from your session decks: the module library, narrative arcs, signature lines, and the deck design language. Rhai uses this to prep session materials in your style.'
};

function ContextPanel() {
  const authedFetch = useAuthedFetch();
  const { user } = useAuth();
  const [sections, setSections] = useState<ContextSection[] | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const res = await authedFetch('/api/rhai/context');
      if (res.ok) setSections(((await res.json()) as { sections: ContextSection[] }).sections);
    })().catch(() => undefined);
  }, [user, authedFetch]);

  return (
    <Panel
      title="Context"
      sub="Rhai's long-term memory about you. Everything here is baked into every pass it makes — the more you write, the smarter it gets."
    >
      {sections === null ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : (
        <div className="space-y-5">
          {sections.map(s => (
            <ContextEditor key={s.id} section={s} authedFetch={authedFetch} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function ContextEditor({
  section,
  authedFetch
}: {
  section: ContextSection;
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const [body, setBody] = useState(section.body);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = (value: string) => {
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await authedFetch('/api/rhai/context', {
        method: 'PUT',
        body: JSON.stringify({ id: section.id, body: value })
      }).catch(() => undefined);
      setStatus('saved');
    }, 900);
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const isLibrary = SECTION_MODE[section.id] === 'library';

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-ink-900">{section.title}</p>
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
              isLibrary ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-700'
            }`}
            title={
              isLibrary
                ? 'Rhai always carries a short digest of this; it reads the full text only when a task needs it.'
                : 'Loaded in full into every Rhai pass.'
            }
          >
            {isLibrary ? 'On demand' : 'Always loaded'}
          </span>
        </div>
        <span className="text-[10px] text-ink-400">{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}</span>
      </div>
      <p className="mb-2 text-[11px] text-ink-400">{CONTEXT_HINTS[section.id] ?? ''}</p>
      {isLibrary && section.digest && (
        <p className="mb-2 rounded-md border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-[11px] leading-relaxed text-indigo-900">
          <span className="font-semibold">Rhai's index card:</span> {section.digest}
        </p>
      )}
      <textarea
        value={body}
        onChange={e => {
          setBody(e.target.value);
          save(e.target.value);
        }}
        placeholder="Paste / write freely — markdown welcome."
        className="h-40 w-full resize-y rounded border border-ink-200 bg-white px-3 py-2 text-sm leading-relaxed text-ink-800 focus:border-ink-300 focus:outline-none"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skills registry
// ---------------------------------------------------------------------------

function SkillsPanel() {
  const authedFetch = useAuthedFetch();
  const { user } = useAuth();
  const [skills, setSkills] = useState<RhaiSkill[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ tone: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const res = await authedFetch('/api/rhai/skills');
      if (res.ok) setSkills(((await res.json()) as { skills: RhaiSkill[] }).skills);
    })().catch(() => undefined);
  }, [user, authedFetch]);

  const persist = (next: RhaiSkill[]) => {
    setSkills(next);
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await authedFetch('/api/rhai/skills', { method: 'PUT', body: JSON.stringify({ skills: next }) }).catch(
        () => undefined
      );
      setStatus('saved');
    }, 700);
  };

  const addSkill = () => {
    if (!skills) return;
    const id = `skill-${Date.now()}`;
    persist([
      ...skills,
      { id, name: 'New skill', description: '', model: 'claude-sonnet-5', enabled: true }
    ]);
  };

  const syncFromDisk = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await authedFetch('/api/rhai/skills/sync', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        reason?: string;
        scanned?: number;
        added?: number;
        refreshed?: number;
        total?: number;
      };
      if (res.status === 409 && data.reason === 'no-fs-access') {
        setSyncMsg({ tone: 'warn', text: data.message ?? 'Sync only works when running locally.' });
      } else if (!res.ok || !data.ok) {
        setSyncMsg({ tone: 'err', text: data.message ?? `Sync failed (${res.status})` });
      } else {
        setSyncMsg({
          tone: 'ok',
          text: `Synced ${data.scanned} · ${data.added} new, ${data.refreshed} refreshed · registry has ${data.total}.`
        });
        // Pull the fresh list.
        const r = await authedFetch('/api/rhai/skills');
        if (r.ok) setSkills(((await r.json()) as { skills: RhaiSkill[] }).skills);
      }
    } catch (e) {
      setSyncMsg({ tone: 'err', text: e instanceof Error ? e.message : 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Panel
      title="Skills"
      sub="What Rhai can reach for — your Claude Code & Claude chat skills, each with a default model. Heavy builds get the big models; routine drafting stays cheap."
    >
      {skills === null ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] text-ink-400">{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={syncFromDisk}
                disabled={syncing}
                className="rounded-md border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60"
                title="Scan ~/.claude/skills on your Mac and merge into the registry. Requires local dev."
              >
                {syncing ? 'Syncing…' : '↻ Sync from ~/.claude/skills'}
              </button>
              <button
                type="button"
                onClick={addSkill}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-600"
              >
                + Add skill
              </button>
            </div>
          </div>
          {syncMsg && (
            <p
              className={`mb-3 rounded-md border px-3 py-2 text-xs ${
                syncMsg.tone === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : syncMsg.tone === 'warn'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {syncMsg.text}
            </p>
          )}
          <div className="space-y-2">
            {skills.map((sk, idx) => (
              <div key={sk.id} className={`rounded-lg border bg-white p-3 ${sk.enabled ? 'border-ink-200' : 'border-ink-100 opacity-60'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={sk.name}
                    onChange={e => persist(skills.map((s, i) => (i === idx ? { ...s, name: e.target.value } : s)))}
                    className="min-w-[200px] flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-ink-900 hover:border-ink-200 focus:border-ink-300 focus:bg-white focus:outline-none"
                  />
                  {sk.stage && (
                    <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-500">{sk.stage}</span>
                  )}
                  <select
                    value={sk.model}
                    onChange={e => persist(skills.map((s, i) => (i === idx ? { ...s, model: e.target.value } : s)))}
                    className="rounded border border-ink-200 bg-white px-1.5 py-1 text-xs text-ink-700"
                  >
                    {MODEL_OPTIONS.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-600">
                    <input
                      type="checkbox"
                      checked={sk.enabled}
                      onChange={e => persist(skills.map((s, i) => (i === idx ? { ...s, enabled: e.target.checked } : s)))}
                      className="h-3.5 w-3.5 rounded border-ink-300 text-accent focus:ring-accent"
                    />
                    enabled
                  </label>
                </div>
                <textarea
                  value={sk.description}
                  onChange={e => persist(skills.map((s, i) => (i === idx ? { ...s, description: e.target.value } : s)))}
                  placeholder="What this skill does / when Rhai should reach for it…"
                  rows={2}
                  className="mt-2 w-full rounded border border-ink-100 bg-white px-2 py-1.5 text-xs text-ink-600 focus:border-ink-300 focus:outline-none"
                />
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-ink-400">
            Execution happens through the Claude Code hands: approve a suggestion on the Today tab, then run{' '}
            <code className="rounded bg-ink-100 px-1">npm run rhai:intents</code> in Claude Code — it reads the queue and
            runs the matching skill with the model set here, staging drafts for your sign-off.
          </p>
        </>
      )}
    </Panel>
  );
}
