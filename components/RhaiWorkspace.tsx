'use client';

// The Rhai workspace — the surface where Rhea and her AI cofounder meet.
// Tabs: Pipeline (the existing LeadsDashboard) · Today (Rhai's proactive
// suggestions) · Ideas (scratchpad Rhai enriches) · Context (the vault) ·
// Skills (registry + default models). All operator-only.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { LeadsDashboard } from './LeadsDashboard';
import {
  IDEA_STATUS_LABELS,
  MODEL_OPTIONS,
  SUGGESTION_KIND_LABELS,
  type ContextSection,
  type RhaiIdea,
  type RhaiSkill,
  type RhaiSuggestion
} from '@/lib/rhai/types';

type Tab = 'pipeline' | 'today' | 'ideas' | 'context' | 'skills';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'today', label: 'Rhai · Today' },
  { id: 'ideas', label: 'Ideas' },
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

export function RhaiWorkspace() {
  const [tab, setTab] = useState<Tab>('pipeline');

  return (
    <div>
      <div className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-7xl gap-1 px-6">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium ${
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
      {tab === 'ideas' && <IdeasPanel />}
      {tab === 'context' && <ContextPanel />}
      {tab === 'skills' && <SkillsPanel />}
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
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
      <p className="mt-1 text-sm text-ink-500">{sub}</p>
      <div className="mt-6">
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

  return (
    <Panel
      title="Rhai · Today"
      sub="Rhai reads your pipeline, smart notes, and parked ideas, then proposes the highest-leverage moves. Approve to queue for execution — nothing reaches a client without you."
    >
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
      ) : proposed.length === 0 && approved.length === 0 ? (
        <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
          No suggestions yet — run the morning pass and Rhai will do a full read of the business.
        </p>
      ) : (
        <div className="space-y-6">
          {proposed.length > 0 && (
            <section className="space-y-2">
              {proposed.map(s => (
                <SuggestionCard key={s.id} s={s} onStatus={setStatus} />
              ))}
            </section>
          )}
          {approved.length > 0 && (
            <section>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Approved — queued for Claude Code hands
              </h2>
              <p className="mb-2 text-xs text-ink-400">
                Run <code className="rounded bg-ink-100 px-1">npm run rhai:intents</code> in a Claude Code session — it
                picks these up and executes them with your skills & connectors, drafting everything for your sign-off.
              </p>
              <div className="space-y-2">
                {approved.map(s => (
                  <SuggestionCard key={s.id} s={s} onStatus={setStatus} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Panel>
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
                className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
              >
                Approve
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
            <button
              type="button"
              onClick={() => onStatus(s.id, 'done')}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-800 hover:bg-emerald-100"
            >
              Mark done
            </button>
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
        <div className="space-y-3">
          {ideas.map(i => (
            <IdeaCard key={i.id} idea={i} onPatch={patch} onDelete={remove} onEnrich={enrich} />
          ))}
        </div>
      )}
    </Panel>
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
  const [answer, setAnswer] = useState('');
  const busy = idea.status === 'researching';

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

      {(idea.status === 'brainstormed' || idea.status === 'parked') && (
        <div className="mt-3 flex gap-2 text-[11px]">
          <button type="button" onClick={() => onPatch(idea.id, { status: 'promoted' })} className="text-indigo-700 hover:underline">
            Promote to lead →
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
  templates: 'Email tone rules, invoice terms, anything Rhai must respect when drafting comms.'
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

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-900">{section.title}</p>
        <span className="text-[10px] text-ink-400">{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}</span>
      </div>
      <p className="mb-2 text-[11px] text-ink-400">{CONTEXT_HINTS[section.id] ?? ''}</p>
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

  return (
    <Panel
      title="Skills"
      sub="What Rhai can reach for — your Claude Code & Claude chat skills, each with a default model. Heavy builds get the big models; routine drafting stays cheap."
    >
      {skills === null ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] text-ink-400">{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}</span>
            <button
              type="button"
              onClick={addSkill}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-600"
            >
              + Add skill
            </button>
          </div>
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
