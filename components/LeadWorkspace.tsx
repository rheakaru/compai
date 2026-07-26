'use client';

// The per-client workspace — Rhai as business partner on one case.
// Left: note sessions (each meeting its own doc, typed or dictated).
// Right: Rhai's understanding (summary + top-5, editable) and the client
// scan — executable next actions that run as Rhai tasks.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useAuthedFetch } from './useAuthedFetch';
import { useVoice } from './useVoice';
import { openPerson } from './RhaiPeople';
import { DocumentsSection } from './LeadDocuments';
import {
  STAGE_LABELS,
  type LeadNoteSession,
  type LeadScanAction,
  type WorkshopLead
} from '@/lib/leads/types';
import type { RhaiTask } from '@/lib/rhai/types';

const ACTION_KIND_META: Record<LeadScanAction['kind'], { label: string; research: boolean }> = {
  research_industry: { label: 'Research', research: true },
  research_solution: { label: 'Solution research', research: true },
  draft_email: { label: 'Draft email', research: false },
  draft_proposal: { label: 'Draft proposal', research: false },
  prep_deck: { label: 'Prep deck', research: false },
  other: { label: 'Task', research: false }
};

export function LeadWorkspace({ leadId }: { leadId: string }) {
  const { user, signIn } = useAuth();
  const authedFetch = useAuthedFetch();
  const [lead, setLead] = useState<WorkshopLead | null>(null);
  const [sessions, setSessions] = useState<LeadNoteSession[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [leadRes, notesRes] = await Promise.all([
      authedFetch(`/api/leads/${leadId}`),
      authedFetch(`/api/leads/${leadId}/notes`)
    ]);
    if (!leadRes.ok) throw new Error(await leadRes.text());
    setLead(((await leadRes.json()) as { lead: WorkshopLead }).lead);
    if (notesRes.ok) setSessions(((await notesRes.json()) as { sessions: LeadNoteSession[] }).sessions);
  }, [authedFetch, leadId]);

  useEffect(() => {
    if (!user) return;
    load().catch(e => setErr(e instanceof Error ? e.message : 'load failed'));
  }, [user, load]);

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <button
          type="button"
          onClick={() => signIn().catch(() => undefined)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Sign in with Google
        </button>
      </div>
    );
  }
  if (err)
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-rose-700">{err}</p>
      </div>
    );
  if (!lead)
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-ink-400">Loading…</p>
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/leads" className="eyebrow hover:text-ink-700">
            ← Pipeline
          </Link>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-ink-900">
            <button type="button" onClick={() => lead.person && openPerson(lead.person)} className="hover:underline">
              {lead.person || 'Unnamed'}
            </button>
            {lead.company && <span className="text-ink-400"> · {lead.company}</span>}
          </h1>
          <p className="mt-1 text-xs text-ink-500">
            {STAGE_LABELS[lead.stage]} · {lead.likelihood}
            {lead.workshopDate ? ` · workshop ${lead.workshopDate}` : ''}
            {lead.nextSteps ? ` · next: ${lead.nextSteps}` : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <NotesColumn
          leadId={leadId}
          lead={lead}
          onLead={setLead}
          sessions={sessions}
          onAdded={s => setSessions(prev => [s, ...(prev ?? [])])}
        />
        <div className="space-y-6">
          <LinkedPerson name={lead.person} />
          <UnderstandingPanel lead={lead} onLead={setLead} />
          <DocumentsSection leadId={leadId} />
          <ScanPanel lead={lead} onLead={setLead} onNotesChanged={() => load().catch(() => undefined)} />
          <LeadTasksCard leadId={leadId} onNotesChanged={() => load().catch(() => undefined)} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes column — session docs
// ---------------------------------------------------------------------------

function NotesColumn({
  leadId,
  lead,
  onLead,
  sessions,
  onAdded
}: {
  leadId: string;
  lead: WorkshopLead;
  onLead: (l: WorkshopLead) => void;
  sessions: LeadNoteSession[] | null;
  onAdded: (s: LeadNoteSession) => void;
}) {
  const authedFetch = useAuthedFetch();
  const [draft, setDraft] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const voice = useVoice(t => setDraft(d => (d ? d + ' ' + t : t)));

  const add = async () => {
    const text = draft.trim();
    if (!text || saving) return;
    if (voice.listening) voice.toggle();
    setSaving(true);
    try {
      const res = await authedFetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ text, label: label.trim() || undefined, source: 'typed' })
      });
      if (res.ok) {
        onAdded(((await res.json()) as { session: LeadNoteSession }).session);
        setDraft('');
        setLabel('');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <NextStepBar leadId={leadId} lead={lead} onLead={onLead} />
      <div className="rounded-lg border border-ink-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="eyebrow">Add a note</p>
          {voice.supported && (
            <button
              type="button"
              onClick={voice.toggle}
              className={`rounded-full border px-2 py-1 text-xs ${
                voice.listening ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-ink-200 text-ink-500 hover:bg-ink-50'
              }`}
            >
              {voice.listening ? '● recording' : '🎙 dictate'}
            </button>
          )}
        </div>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Label — e.g. “Recce day 1”, “Call with CFO” (optional)"
          className="mb-2 w-full rounded border border-ink-100 px-2.5 py-1.5 text-xs focus:border-ink-300 focus:outline-none"
        />
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={5}
          placeholder="Type or dictate this meeting's notes — each add is its own doc, so you'll always know which meeting said what."
          className="w-full rounded border border-ink-100 px-2.5 py-2 text-sm leading-relaxed focus:border-ink-300 focus:outline-none"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={add}
            disabled={saving || !draft.trim()}
            className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-600 disabled:opacity-50"
          >
            {saving ? 'Saving…' : '+ Save session'}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {sessions === null ? (
          <p className="text-xs text-ink-400">Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-6 text-center text-xs text-ink-400">
            No sessions yet — notes from each call/meeting land here as separate docs.
          </p>
        ) : (
          sessions.map(s => <SessionCard key={s.id} s={s} />)
        )}
      </div>
    </div>
  );
}

function SessionCard({ s }: { s: LeadNoteSession }) {
  const [open, setOpen] = useState(false);
  const long = s.text.length > 400;
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink-900">
          {s.label || (s.source === 'rhai-research' ? 'Rhai research' : s.source === 'claude-sync' ? 'Claude project sync' : 'Notes')}
        </p>
        <p className="text-[10px] text-ink-400">
          {new Date(s.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{' '}
          · {s.source}
        </p>
      </div>
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-700">
        {open || !long ? s.text : s.text.slice(0, 400) + '…'}
      </p>
      {long && (
        <button type="button" onClick={() => setOpen(v => !v)} className="mt-1 text-[11px] text-indigo-600 hover:underline">
          {open ? 'Show less' : 'Show all'}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Understanding panel
// ---------------------------------------------------------------------------

function UnderstandingPanel({ lead, onLead }: { lead: WorkshopLead; onLead: (l: WorkshopLead) => void }) {
  const authedFetch = useAuthedFetch();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(lead.understanding?.summary ?? '');
  const [bullets, setBullets] = useState((lead.understanding?.bullets ?? []).join('\n'));

  useEffect(() => {
    setSummary(lead.understanding?.summary ?? '');
    setBullets((lead.understanding?.bullets ?? []).join('\n'));
  }, [lead.understanding]);

  const rebuild = async () => {
    setBusy(true);
    try {
      const res = await authedFetch(`/api/leads/${lead.id}/understand`, { method: 'POST' });
      if (res.ok) {
        const { understanding } = (await res.json()) as { understanding: WorkshopLead['understanding'] };
        onLead({ ...lead, understanding });
      }
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    const understanding = {
      summary: summary.trim(),
      bullets: bullets.split('\n').map(b => b.replace(/^[-•]\s*/, '').trim()).filter(Boolean).slice(0, 5),
      updatedAt: Date.now()
    };
    onLead({ ...lead, understanding });
    setEditing(false);
    await authedFetch(`/api/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ understanding }) }).catch(
      () => undefined
    );
  };

  const u = lead.understanding;
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="eyebrow">Rhai&apos;s understanding</p>
        <div className="flex gap-2">
          {u && !editing && (
            <button type="button" onClick={() => setEditing(true)} className="text-[11px] text-ink-500 hover:underline">
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={rebuild}
            disabled={busy}
            className="rounded-md border border-ink-200 px-2.5 py-1 text-[11px] text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            {busy ? 'Reading…' : u ? '↻ Rebuild from notes' : '✨ Build from notes'}
          </button>
        </div>
      </div>

      {!u && !editing ? (
        <p className="text-xs text-ink-400">
          Rhai hasn&apos;t read this client yet — add notes, then build the shared understanding.
        </p>
      ) : editing ? (
        <div>
          <textarea
            value={summary}
            onChange={e => setSummary(e.target.value)}
            rows={3}
            className="w-full rounded border border-ink-100 px-2.5 py-2 text-xs leading-relaxed focus:outline-none"
          />
          <textarea
            value={bullets}
            onChange={e => setBullets(e.target.value)}
            rows={5}
            placeholder="One bullet per line (max 5)"
            className="mt-2 w-full rounded border border-ink-100 px-2.5 py-2 text-xs leading-relaxed focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="text-[11px] text-ink-400 hover:underline">
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              className="rounded-md bg-ink-900 px-3 py-1 text-[11px] font-medium text-cream"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs leading-relaxed text-ink-700">{u!.summary}</p>
          <ol className="mt-2 space-y-1.5">
            {u!.bullets.map((b, i) => (
              <li key={i} className="flex gap-2 text-xs text-ink-800">
                <span className="font-display text-ink-300">{String(i + 1).padStart(2, '0')}</span>
                <span>{b}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[10px] text-ink-400">
            Last read{' '}
            {new Date(u!.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scan panel — executable next actions
// ---------------------------------------------------------------------------

function ScanPanel({
  lead,
  onLead,
  onNotesChanged
}: {
  lead: WorkshopLead;
  onLead: (l: WorkshopLead) => void;
  onNotesChanged: () => void;
}) {
  const authedFetch = useAuthedFetch();
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState<Record<string, 'running' | 'done' | 'failed'>>({});
  const [results, setResults] = useState<Record<string, string>>({});

  const rescan = async () => {
    setBusy(true);
    try {
      const res = await authedFetch(`/api/leads/${lead.id}/scan`, { method: 'POST' });
      if (res.ok) {
        const { scan } = (await res.json()) as { scan: WorkshopLead['scan'] };
        onLead({ ...lead, scan });
        setRunning({});
        setResults({});
      }
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (a: LeadScanAction) => {
    setRunning(prev => ({ ...prev, [a.id]: 'running' }));
    try {
      const isResearch = ACTION_KIND_META[a.kind].research;
      const createRes = await authedFetch('/api/rhai/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: a.title,
          detail: a.detail,
          leadId: lead.id,
          leadLabel: [lead.person, lead.company].filter(Boolean).join(' · '),
          appendToNotes: isResearch
        })
      });
      if (!createRes.ok) throw new Error(await createRes.text());
      const { task } = (await createRes.json()) as { task: RhaiTask };
      const runRes = await authedFetch(`/api/rhai/tasks/${task.id}/run`, { method: 'POST' });
      if (!runRes.ok) throw new Error(await runRes.text());
      const done = ((await runRes.json()) as { task: RhaiTask }).task;
      setRunning(prev => ({ ...prev, [a.id]: 'done' }));
      setResults(prev => ({ ...prev, [a.id]: done.result ?? '' }));
      if (isResearch) onNotesChanged();
    } catch {
      setRunning(prev => ({ ...prev, [a.id]: 'failed' }));
    }
  };

  const scan = lead.scan;
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="eyebrow">Rhai&apos;s scan — what I can do next</p>
        <button
          type="button"
          onClick={rescan}
          disabled={busy}
          className="rounded-md border border-ink-200 px-2.5 py-1 text-[11px] text-ink-700 hover:bg-ink-50 disabled:opacity-50"
        >
          {busy ? 'Scanning…' : scan ? '↻ Re-scan' : '✨ Scan this case'}
        </button>
      </div>

      {!scan ? (
        <p className="text-xs text-ink-400">
          Run a scan and Rhai proposes concrete actions it can execute for this client — research, drafts, prep.
        </p>
      ) : (
        <>
          <p className="mb-2 text-[10px] text-ink-400">
            Scanned{' '}
            {new Date(scan.generatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
          <div className="space-y-2">
            {scan.actions.map(a => {
              const state = running[a.id];
              return (
                <div key={a.id} className="rounded-md border border-ink-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-xs font-semibold text-ink-900">
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-700">
                          {ACTION_KIND_META[a.kind].label}
                        </span>
                        {a.title}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-ink-600">{a.detail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => runAction(a)}
                      disabled={state === 'running' || state === 'done'}
                      className={`shrink-0 rounded-md px-3 py-1 text-[11px] font-medium ${
                        state === 'done'
                          ? 'bg-emerald-50 text-emerald-700'
                          : state === 'failed'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-ink-900 text-cream hover:bg-ink-800'
                      } disabled:opacity-70`}
                    >
                      {state === 'running' ? 'Running…' : state === 'done' ? '✓ Done' : state === 'failed' ? 'Retry' : '▶ Run'}
                    </button>
                  </div>
                  {results[a.id] && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] text-indigo-600">View result</summary>
                      <p className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-cream-50 p-2 text-[11px] leading-relaxed text-ink-700">
                        {results[a.id]}
                      </p>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-ink-400">
            Actions run as Rhai tasks — research lands back in the notes; drafts wait for your review on the Tasks board.
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Running notes — the lead's existing smartNotes + next steps, editable here
// so nothing you already typed on the pipeline row "disappears" on this page.
// These feed Rhai's understanding alongside the session docs.
// ---------------------------------------------------------------------------

// Just the next step — a single editable line. The old "running notes" blob
// is gone; each note is now its own timestamped session in the log below.
function NextStepBar({
  leadId,
  lead,
  onLead
}: {
  leadId: string;
  lead: WorkshopLead;
  onLead: (l: WorkshopLead) => void;
}) {
  const authedFetch = useAuthedFetch();
  const [next, setNext] = useState(lead.nextSteps ?? '');
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    setNext(lead.nextSteps ?? '');
  }, [lead.nextSteps]);

  const save = async () => {
    if (next === (lead.nextSteps ?? '')) return;
    onLead({ ...lead, nextSteps: next });
    setSaved(true);
    await authedFetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify({ nextSteps: next })
    }).catch(() => undefined);
  };

  return (
    <div className="mb-4 rounded-lg border border-ink-200 bg-white p-3">
      <p className="eyebrow mb-1">Next step</p>
      <input
        type="text"
        value={next}
        onChange={e => {
          setNext(e.target.value);
          setSaved(false);
        }}
        onBlur={save}
        onKeyDown={e => e.key === 'Enter' && save()}
        placeholder="What's the next move for this client?"
        className="w-full rounded border border-ink-100 px-2.5 py-1.5 text-sm font-medium text-ink-800 focus:border-ink-300 focus:outline-none"
      />
      {!saved && <p className="mt-1 text-[10px] text-ink-400">Press Enter or click away to save</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linked person — surfaces Rhai's people-profile for this client's contact,
// so research you ran on the person shows up on their case too.
// ---------------------------------------------------------------------------

function LinkedPerson({ name }: { name: string }) {
  const authedFetch = useAuthedFetch();
  const [person, setPerson] = useState<{ id: string; summary?: string; headline?: string; status?: string } | null>(
    null
  );
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!name?.trim()) return;
    (async () => {
      const res = await authedFetch('/api/rhai/people');
      if (res.ok) {
        const { people } = (await res.json()) as {
          people: { id: string; name: string; summary?: string; headline?: string; status?: string }[];
        };
        const needle = name.toLowerCase();
        const found =
          people.find(p => p.name.toLowerCase() === needle) ??
          people.find(p => p.name.toLowerCase().includes(needle) || needle.includes(p.name.toLowerCase()));
        setPerson(found ?? null);
      }
      setChecked(true);
    })().catch(() => setChecked(true));
  }, [name, authedFetch]);

  if (!name?.trim() || (checked && !person)) return null;

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="eyebrow">Contact — Rhai&apos;s profile</p>
        <button type="button" onClick={() => openPerson(name)} className="text-[11px] text-indigo-600 hover:underline">
          Open full profile →
        </button>
      </div>
      {!person ? (
        <p className="text-xs text-ink-400">Loading…</p>
      ) : (
        <>
          {person.headline && <p className="text-xs font-medium text-ink-800">{person.headline}</p>}
          {person.summary ? (
            <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[11px] leading-relaxed text-ink-600">
              {person.summary.replace(/<\/?cite[^>]*>/gi, '')}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-ink-400">
              Not researched yet — open the profile and run Rhai on them.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tasks for this lead — everything queued/run for this client, right on the
// case. Promoted ideas and scan actions land here; run them without leaving.
// ---------------------------------------------------------------------------

function LeadTasksCard({ leadId, onNotesChanged }: { leadId: string; onNotesChanged: () => void }) {
  const authedFetch = useAuthedFetch();
  const [tasks, setTasks] = useState<RhaiTask[] | null>(null);
  const [openResult, setOpenResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authedFetch('/api/rhai/tasks');
    if (res.ok) {
      const all = ((await res.json()) as { tasks: RhaiTask[] }).tasks;
      setTasks(all.filter(t => t.leadId === leadId));
    }
  }, [authedFetch, leadId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const run = async (id: string) => {
    setTasks(prev => (prev ? prev.map(t => (t.id === id ? { ...t, status: 'running' } : t)) : prev));
    try {
      await authedFetch(`/api/rhai/tasks/${id}/run`, { method: 'POST' });
    } finally {
      await load().catch(() => undefined);
      onNotesChanged(); // research results append to notes
    }
  };

  if (!tasks || tasks.length === 0) return null;

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="eyebrow">Rhai&apos;s tasks for this client</p>
        <Link href="/leads" className="text-[10px] text-ink-400 hover:underline">
          full board on Tasks tab
        </Link>
      </div>
      <div className="space-y-2">
        {tasks.map(t => (
          <div key={t.id} className="rounded-md border border-ink-100 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 flex-1 truncate text-xs font-medium text-ink-900">{t.title}</p>
              {t.status === 'queued' || t.status === 'failed' ? (
                <button
                  type="button"
                  onClick={() => run(t.id)}
                  className="shrink-0 rounded-md bg-ink-900 px-2.5 py-1 text-[11px] font-medium text-cream hover:bg-ink-800"
                >
                  ▶ Run
                </button>
              ) : t.status === 'running' ? (
                <span className="shrink-0 text-[11px] text-amber-600">working…</span>
              ) : (
                <span className="shrink-0 text-[11px] text-emerald-700">✓ done</span>
              )}
            </div>
            {t.status === 'done' && t.documentId && (
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent('rhai:openDoc', { detail: { docId: t.documentId } }))
                }
                className="mt-1 text-[11px] font-medium text-indigo-600 hover:underline"
              >
                📄 Open document →
              </button>
            )}
            {t.status === 'done' && !t.documentId && t.result && (
              <>
                <button
                  type="button"
                  onClick={() => setOpenResult(openResult === t.id ? null : t.id)}
                  className="mt-1 text-[11px] text-indigo-600 hover:underline"
                >
                  {openResult === t.id ? 'Hide result' : 'View result'}
                </button>
                {openResult === t.id && (
                  <p className="mt-1 max-h-56 overflow-y-auto whitespace-pre-wrap rounded bg-cream-50 p-2 text-[11px] leading-relaxed text-ink-700">
                    {t.result}
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
