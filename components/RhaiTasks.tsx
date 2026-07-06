'use client';

// The task board — work assigned to Rhai. Queue tasks (freeform, per client,
// optionally shaped by a skill), run them in parallel, read results here.

import { useCallback, useEffect, useState } from 'react';
import { useAuthedFetch } from './useAuthedFetch';
import type { RhaiSkill, RhaiTask, RhaiTaskStatus } from '@/lib/rhai/types';
import type { WorkshopLead } from '@/lib/leads/types';

const COLUMNS: { status: RhaiTaskStatus; label: string }[] = [
  { status: 'queued', label: 'Queued' },
  { status: 'running', label: 'Running' },
  { status: 'done', label: 'Done' },
  { status: 'failed', label: 'Failed' }
];

export function TasksPanel() {
  const authedFetch = useAuthedFetch();
  const [tasks, setTasks] = useState<RhaiTask[] | null>(null);
  const [leads, setLeads] = useState<WorkshopLead[]>([]);
  const [skills, setSkills] = useState<RhaiSkill[]>([]);
  const [title, setTitle] = useState('');
  const [leadId, setLeadId] = useState('');
  const [skillId, setSkillId] = useState('');

  const load = useCallback(async () => {
    const res = await authedFetch('/api/rhai/tasks');
    if (res.ok) setTasks(((await res.json()) as { tasks: RhaiTask[] }).tasks);
  }, [authedFetch]);

  useEffect(() => {
    load().catch(() => undefined);
    (async () => {
      const [lr, sr] = await Promise.all([authedFetch('/api/leads'), authedFetch('/api/rhai/skills')]);
      if (lr.ok) setLeads(((await lr.json()) as { leads: WorkshopLead[] }).leads);
      if (sr.ok) setSkills(((await sr.json()) as { skills: RhaiSkill[] }).skills);
    })().catch(() => undefined);
  }, [authedFetch, load]);

  const add = async (andRun: boolean) => {
    const t = title.trim();
    if (!t) return;
    setTitle('');
    const lead = leads.find(l => l.id === leadId);
    const res = await authedFetch('/api/rhai/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: t,
        detail: t,
        ...(leadId ? { leadId, leadLabel: lead ? [lead.person, lead.company].filter(Boolean).join(' · ') : '' } : {}),
        ...(skillId ? { skillId } : {})
      })
    });
    if (!res.ok) return;
    const { task } = (await res.json()) as { task: RhaiTask };
    setTasks(prev => [task, ...(prev ?? [])]);
    if (andRun) runTask(task.id);
  };

  const runTask = async (id: string) => {
    setTasks(prev => (prev ? prev.map(t => (t.id === id ? { ...t, status: 'running' } : t)) : prev));
    // Fire-and-forget per task — several can run in parallel; refresh at end.
    try {
      await authedFetch(`/api/rhai/tasks/${id}/run`, { method: 'POST' });
    } finally {
      load().catch(() => undefined);
    }
  };

  const remove = async (id: string) => {
    setTasks(prev => (prev ? prev.filter(t => t.id !== id) : prev));
    await authedFetch('/api/rhai/tasks', { method: 'PATCH', body: JSON.stringify({ id, delete: true }) }).catch(
      () => undefined
    );
  };

  return (
    <div>
      <div className="mb-5 rounded-lg border border-ink-200 bg-white p-4">
        <p className="eyebrow mb-2">Assign Rhai a task</p>
        <textarea
          value={title}
          onChange={e => setTitle(e.target.value)}
          rows={2}
          placeholder='e.g. "Research the D2C fulfilment stack in India and what Mitali should ask vendors" — client context rides along automatically.'
          className="w-full rounded border border-ink-100 px-2.5 py-2 text-sm focus:border-ink-300 focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={leadId}
            onChange={e => setLeadId(e.target.value)}
            className="rounded border border-ink-200 bg-white px-2 py-1.5 text-xs text-ink-700"
          >
            <option value="">No client</option>
            {leads.map(l => (
              <option key={l.id} value={l.id}>
                {[l.person, l.company].filter(Boolean).join(' · ') || l.id}
              </option>
            ))}
          </select>
          <select
            value={skillId}
            onChange={e => setSkillId(e.target.value)}
            className="rounded border border-ink-200 bg-white px-2 py-1.5 text-xs text-ink-700"
          >
            <option value="">No skill framing</option>
            {skills
              .filter(s => s.enabled)
              .map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => add(false)}
              disabled={!title.trim()}
              className="rounded-md border border-ink-200 px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              Queue
            </button>
            <button
              type="button"
              onClick={() => add(true)}
              disabled={!title.trim()}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-600 disabled:opacity-50"
            >
              ▶ Run now
            </button>
          </div>
        </div>
      </div>

      {tasks === null ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map(col => (
            <TaskColumn
              key={col.status}
              label={col.label}
              tasks={tasks
                .filter(t => t.status === col.status)
                .sort((a, b) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt))}
              onRun={runTask}
              onDelete={remove}
              collapseAfter={col.status === 'done' ? 5 : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// One board column. Done accumulates fast — cap it at 5 with an expand.
function TaskColumn({
  label,
  tasks,
  onRun,
  onDelete,
  collapseAfter
}: {
  label: string;
  tasks: RhaiTask[];
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
  collapseAfter?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const showAll = !collapseAfter || expanded || tasks.length <= collapseAfter;
  const shown = showAll ? tasks : tasks.slice(0, collapseAfter);
  const hidden = tasks.length - shown.length;
  return (
    <div>
      <p className="eyebrow mb-2">
        {label} · {tasks.length}
      </p>
      <div className="space-y-2">
        {shown.map(t => (
          <TaskCard key={t.id} t={t} onRun={() => onRun(t.id)} onDelete={() => onDelete(t.id)} />
        ))}
        {tasks.length === 0 && (
          <p className="rounded-md border border-dashed border-ink-200 px-3 py-4 text-center text-[11px] text-ink-300">
            —
          </p>
        )}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full rounded-md border border-dashed border-ink-200 px-3 py-2 text-[11px] text-ink-500 hover:bg-ink-50"
          >
            Show {hidden} older…
          </button>
        )}
        {expanded && collapseAfter && tasks.length > collapseAfter && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="w-full text-[10px] text-ink-400 hover:underline"
          >
            Collapse
          </button>
        )}
      </div>
    </div>
  );
}

function TaskCard({ t, onRun, onDelete }: { t: RhaiTask; onRun: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-3">
      <p className="text-xs font-semibold text-ink-900">{t.title}</p>
      {t.leadLabel && <p className="mt-0.5 text-[10px] text-ink-500">{t.leadLabel}</p>}
      <p className="mt-1 text-[10px] text-ink-400">
        {new Date(t.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        {t.finishedAt && t.startedAt ? ` · ${Math.round((t.finishedAt - t.startedAt) / 1000)}s` : ''}
      </p>
      {t.error && <p className="mt-1 text-[11px] text-rose-600">{t.error}</p>}
      <div className="mt-2 flex items-center gap-2">
        {(t.status === 'queued' || t.status === 'failed') && (
          <button
            type="button"
            onClick={onRun}
            className="rounded-md bg-ink-900 px-2.5 py-1 text-[11px] font-medium text-cream hover:bg-ink-800"
          >
            ▶ Run
          </button>
        )}
        {t.status === 'running' && <span className="text-[11px] text-amber-600">working…</span>}
        {t.result && (
          <button type="button" onClick={() => setOpen(v => !v)} className="text-[11px] text-indigo-600 hover:underline">
            {open ? 'Hide result' : 'View result'}
          </button>
        )}
        <button type="button" onClick={onDelete} className="ml-auto text-[11px] text-ink-300 hover:text-rose-600">
          ✕
        </button>
      </div>
      {open && t.result && (
        <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded bg-cream-50 p-2 text-[11px] leading-relaxed text-ink-700">
          {t.result}
        </p>
      )}
    </div>
  );
}
