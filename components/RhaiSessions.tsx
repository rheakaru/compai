'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useAuthedFetch } from './useAuthedFetch';
import {
  CAR_STATUS_META,
  CHECKLIST_KEYS,
  CHECKLIST_META,
  SESSION_STATUS_META,
  sessionList,
  type ChecklistItem,
  type ChecklistKey,
  type RhaiSession
} from '@/lib/rhai/sessions';

// Session logistics — the screen Rhea and Divya (EA) coordinate off:
// venue + timings for commute planning, car bookings, client-booked travel
// status, the outfit, notes, and the prep / packing / follow-up checklists.

interface TravelInfo {
  tripId: string;
  items: Array<{ kind: string; status: string; detail?: string; confirmation?: string }>;
}

interface SessionRow extends RhaiSession {
  outfitUrl?: string;
  travel?: TravelInfo;
}

type Templates = Record<ChecklistKey, string[]>;

export function RhaiSessions() {
  const authedFetch = useAuthedFetch();
  const { getToken } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [templates, setTemplates] = useState<Templates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    client: '',
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    venue: ''
  });
  const [editTemplates, setEditTemplates] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authedFetch('/api/rhai/sessions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as { sessions: SessionRow[]; templates: Templates };
      setSessions(d.sessions);
      setTemplates(d.templates);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createSession() {
    if (!form.client.trim() || !form.date) return;
    setBusy(true);
    try {
      const res = await authedFetch('/api/rhai/sessions', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setForm({ client: '', title: '', date: '', startTime: '', endTime: '', venue: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, patchBody: Record<string, unknown>) {
    setSessions(prev => prev?.map(s => (s.id === id ? ({ ...s, ...patchBody } as SessionRow) : s)) ?? null);
    await authedFetch('/api/rhai/sessions', { method: 'PATCH', body: JSON.stringify({ id, ...patchBody }) });
  }

  async function uploadOutfit(sessionId: string, file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('sessionId', sessionId);
      const token = await getToken();
      const res = await fetch('/api/rhai/sessions', {
        method: 'POST',
        body: fd,
        headers: token ? { authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`Upload failed (HTTP ${res.status})`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const visible = (sessions ?? []).filter(
    s => showPast || (s.date >= today && s.status !== 'cancelled' && s.status !== 'done')
  );

  return (
    <div className="space-y-4">
      {error && <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>}

      <div className="rounded-md border border-ink-200 bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">New session</p>
        <div className="grid gap-2 sm:grid-cols-6">
          <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm sm:col-span-2" placeholder="Client / company" value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} />
          <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm sm:col-span-2" placeholder="Title (e.g. AI Workshop day 1)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          <button type="button" disabled={busy} onClick={createSession} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50">
            {busy ? 'Adding…' : 'Add session'}
          </button>
          <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm" type="time" title="Start" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
          <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm" type="time" title="End" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
          <input className="rounded-md border border-ink-200 px-2 py-1.5 text-sm sm:col-span-4" placeholder="Venue / office address (for commute + car booking)" value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-ink-500">
          <input type="checkbox" checked={showPast} onChange={e => setShowPast(e.target.checked)} />
          Show past / done sessions
        </label>
        <button type="button" onClick={() => setEditTemplates(t => !t)} className="rounded-md border border-ink-200 px-2.5 py-1 text-xs text-ink-600 hover:bg-ink-50">
          {editTemplates ? 'Close templates' : 'Edit permanent checklists'}
        </button>
      </div>

      {editTemplates && templates && (
        <TemplateEditor
          templates={templates}
          onSave={async t => {
            await authedFetch('/api/rhai/sessions', { method: 'PATCH', body: JSON.stringify({ templates: t }) });
            setEditTemplates(false);
            await load();
          }}
        />
      )}

      {sessions === null ? (
        <p className="text-sm text-ink-500">Loading sessions…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-ink-500">No upcoming sessions.</p>
      ) : (
        visible.map(s => (
          <SessionCard key={s.id} s={s} onPatch={patch} onUploadOutfit={uploadOutfit} busy={busy} />
        ))
      )}
    </div>
  );
}

function SessionCard({
  s,
  onPatch,
  onUploadOutfit,
  busy
}: {
  s: SessionRow;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onUploadOutfit: (id: string, file: File) => Promise<void>;
  busy: boolean;
}) {
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<{ list: ChecklistKey; text: string } | null>(null);
  const statusMeta = SESSION_STATUS_META[s.status];
  const carMeta = CAR_STATUS_META[s.car?.status ?? 'needed'];
  const toggleItem = (list: ChecklistKey, idx: number) => {
    const items = [...sessionList(s, list)];
    items[idx] = { ...items[idx], done: !items[idx].done };
    void onPatch(s.id, { [list]: items });
  };

  return (
    <div className="rounded-md border border-ink-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-ink-900">
            {s.client}
            {s.title ? <span className="ml-2 text-sm font-normal text-ink-500">{s.title}</span> : null}
          </p>
          <p className="mt-0.5 text-sm text-ink-600">
            {new Date(`${s.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            {s.startTime ? ` · ${s.startTime}${s.endTime ? `–${s.endTime}` : ''}` : ''}
          </p>
          {s.venue ? (
            <p className="text-xs text-ink-500">
              📍 {s.venue}{' '}
              <a
                className="text-indigo-600 underline"
                target="_blank"
                rel="noreferrer"
                href={`https://www.google.com/maps/search/${encodeURIComponent(s.venue)}`}
              >
                map
              </a>
            </p>
          ) : (
            <p className="text-xs text-amber-700">No venue yet — add the office address for commute planning.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            title="Cycle status"
            onClick={() =>
              onPatch(s.id, {
                status: s.status === 'tentative' ? 'confirmed' : s.status === 'confirmed' ? 'done' : 'tentative'
              })
            }
            className={`rounded-full border px-2.5 py-1 text-[11px] ${statusMeta.chip}`}
          >
            {statusMeta.label}
          </button>
          <button
            type="button"
            title={s.car?.notes || 'Tap to advance: no car → needed → booked'}
            onClick={() => onPatch(s.id, { car: { ...(s.car ?? {}), status: carMeta.next } })}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${carMeta.chip}`}
          >
            🚗 {carMeta.label}
          </button>
        </div>
      </div>

      {s.travel && s.travel.items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {s.travel.items.map((it, i) => (
            <span
              key={i}
              title={it.confirmation ? `Ref: ${it.confirmation}` : undefined}
              className={`rounded-full border px-2 py-0.5 text-[11px] ${
                it.status === 'booked'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              {it.kind}
              {it.detail ? ` ${it.detail}` : ''} — {it.status}
              {it.confirmation ? ` (${it.confirmation})` : ''}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {/* Outfit */}
        <div className="rounded-md border border-ink-100 p-2.5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Outfit</p>
          {s.outfitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.outfitUrl} alt="Outfit" className="mb-1.5 max-h-44 rounded-md object-cover" />
          ) : (
            <p className="mb-1.5 text-xs text-ink-400">No outfit picked yet.</p>
          )}
          <label className="inline-block cursor-pointer rounded-md border border-ink-200 px-2.5 py-1 text-xs text-ink-700 hover:bg-ink-50">
            {busy ? 'Uploading…' : s.outfitUrl ? 'Replace photo' : 'Upload photo'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void onUploadOutfit(s.id, f);
              }}
            />
          </label>
          {s.outfitNote && <p className="mt-1 text-xs text-ink-500">{s.outfitNote}</p>}
        </div>

        {/* Notes */}
        <div className="rounded-md border border-ink-100 p-2.5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            Notes — packing extras, printouts, on-site contact
          </p>
          <textarea
            className="w-full rounded-md border border-ink-200 px-2 py-1.5 text-sm"
            rows={5}
            value={notesDraft ?? s.notes ?? ''}
            onChange={e => setNotesDraft(e.target.value)}
            onBlur={() => {
              if (notesDraft !== null && notesDraft !== (s.notes ?? '')) {
                void onPatch(s.id, { notes: notesDraft });
              }
            }}
            placeholder="e.g. print 8 copies of the worksheet; ask for parking pass; carry HDMI extender"
          />
        </div>

        {/* Checklists */}
        <div className="space-y-2">
          {CHECKLIST_KEYS.map(list => {
            const items = sessionList(s, list);
            const done = items.filter(i => i.done).length;
            return (
              <div key={list} className="rounded-md border border-ink-100 p-2.5">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  {CHECKLIST_META[list].label} {done}/{items.length}
                </p>
                {items.length === 0 && (
                  <p className="text-[11px] italic text-ink-400">
                    Nothing here yet — this session predates the list. Add items below, or recreate it to pull the
                    current template.
                  </p>
                )}
                <div className="max-h-40 space-y-0.5 overflow-y-auto">
                  {items.map((item: ChecklistItem, idx: number) => (
                    <label key={idx} className="flex cursor-pointer items-start gap-1.5 text-xs text-ink-700">
                      <input type="checkbox" className="mt-0.5" checked={item.done} onChange={() => toggleItem(list, idx)} />
                      <span className={item.done ? 'line-through opacity-50' : ''}>{item.text}</span>
                    </label>
                  ))}
                </div>
                {newItem?.list === list ? (
                  <div className="mt-1 flex gap-1">
                    <input
                      autoFocus
                      className="flex-1 rounded-md border border-ink-200 px-1.5 py-0.5 text-xs"
                      value={newItem.text}
                      onChange={e => setNewItem({ list, text: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newItem.text.trim()) {
                          void onPatch(s.id, {
                            [list]: [...items, { text: newItem.text.trim(), done: false, custom: true }]
                          });
                          setNewItem(null);
                        }
                        if (e.key === 'Escape') setNewItem(null);
                      }}
                      placeholder="Add item, Enter to save"
                    />
                  </div>
                ) : (
                  <button type="button" onClick={() => setNewItem({ list, text: '' })} className="mt-1 text-[11px] text-ink-400 hover:text-ink-600">
                    + add item for this trip
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TemplateEditor({
  templates,
  onSave
}: {
  templates: Templates;
  onSave: (t: Templates) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<ChecklistKey, string>>(
    () => Object.fromEntries(CHECKLIST_KEYS.map(k => [k, (templates[k] ?? []).join('\n')])) as Record<ChecklistKey, string>
  );
  const [saving, setSaving] = useState(false);
  return (
    <div className="rounded-md border border-ink-200 bg-white p-3">
      <p className="mb-2 text-xs text-ink-500">
        One item per line. These are the permanent lists — new sessions copy them; existing
        sessions keep their own copies.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {CHECKLIST_KEYS.map(key => (
          <label key={key} className="block text-xs text-ink-500">
            {CHECKLIST_META[key].label}
            <textarea
              className="mt-0.5 w-full rounded-md border border-ink-200 px-2 py-1.5 font-mono text-xs"
              rows={14}
              value={draft[key]}
              onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          await onSave(
            Object.fromEntries(
              CHECKLIST_KEYS.map(k => [k, draft[k].split('\n').map(l => l.trim()).filter(Boolean)])
            ) as Templates
          );
          setSaving(false);
        }}
        className="mt-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save templates'}
      </button>
    </div>
  );
}
