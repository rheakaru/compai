'use client';

// People intelligence UI: the visible directory (PeoplePanel) and the person
// drawer (profile + notes + research). Any component can open the drawer by
// dispatching: window.dispatchEvent(new CustomEvent('rhai:openPerson',
// { detail: { name } })) — RhaiWorkspace hosts the drawer and listens.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthedFetch } from './useAuthedFetch';
import { useVoice } from './useVoice';
import { PERSON_TIER_LABELS, type PersonConnection, type PersonTier, type RhaiPerson } from '@/lib/rhai/types';

export function openPerson(name: string) {
  window.dispatchEvent(new CustomEvent('rhai:openPerson', { detail: { name } }));
}

/** Defensive: older profiles were saved with web-search <cite> tags in them. */
function clean(text: string): string {
  return text.replace(/<\/?cite[^>]*>/gi, '');
}

const TIER_ORDER: PersonTier[] = ['lead', 'partner', 'collaborator', 'community'];

// ---------------------------------------------------------------------------
// People tab
// ---------------------------------------------------------------------------

export function PeoplePanel({ onOpen }: { onOpen: (p: RhaiPerson) => void }) {
  const authedFetch = useAuthedFetch();
  const [people, setPeople] = useState<RhaiPerson[] | null>(null);
  const [q, setQ] = useState('');
  const [tierFilter, setTierFilter] = useState<PersonTier | 'all'>('all');
  const [adding, setAdding] = useState('');

  const load = useCallback(async () => {
    const res = await authedFetch('/api/rhai/people');
    if (res.ok) setPeople(((await res.json()) as { people: RhaiPerson[] }).people);
  }, [authedFetch]);

  useEffect(() => {
    load().catch(() => undefined);
    const onRefresh = () => load().catch(() => undefined);
    window.addEventListener('rhai:peopleChanged', onRefresh);
    return () => window.removeEventListener('rhai:peopleChanged', onRefresh);
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (people ?? [])
      .filter(p => tierFilter === 'all' || p.tier === tierFilter)
      .filter(
        p =>
          !needle ||
          p.name.toLowerCase().includes(needle) ||
          (p.headline ?? '').toLowerCase().includes(needle) ||
          (p.company ?? '').toLowerCase().includes(needle) ||
          (p.notes ?? '').toLowerCase().includes(needle)
      );
  }, [people, q, tierFilter]);

  const add = async () => {
    const name = adding.trim();
    if (!name) return;
    setAdding('');
    const res = await authedFetch('/api/rhai/people', { method: 'POST', body: JSON.stringify({ name }) });
    if (res.ok) {
      await load();
      onOpen(((await res.json()) as { person: RhaiPerson }).person);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search people, companies, notes…"
          className="min-w-[220px] flex-1 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 focus:border-ink-300 focus:outline-none"
        />
        {(['all', ...TIER_ORDER] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTierFilter(t as PersonTier | 'all')}
            className={`rounded-full border px-3 py-1 text-xs ${
              tierFilter === t
                ? 'border-ink-900 bg-ink-900 text-cream'
                : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
            }`}
          >
            {t === 'all' ? `All · ${people?.length ?? '…'}` : PERSON_TIER_LABELS[t as PersonTier]}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={adding}
          onChange={e => setAdding(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add a person…"
          className="flex-1 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-ink-300 focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
        >
          + Add
        </button>
      </div>

      {people === null ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
          No one matches.
        </p>
      ) : (
        <div className="divide-y divide-ink-100 rounded-lg border border-ink-200 bg-white">
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpen(p)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cream-50"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  p.status === 'researched'
                    ? 'bg-emerald-500'
                    : p.status === 'needs-info'
                      ? 'bg-amber-500'
                      : 'bg-ink-200'
                }`}
                title={p.status}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-semibold text-ink-900">{p.name}</span>
                  <span className="eyebrow">{PERSON_TIER_LABELS[p.tier]}</span>
                </span>
                <span className="block truncate text-xs text-ink-500">
                  {p.headline || p.company || p.notes || '—'}
                </span>
              </span>
              {p.questions && p.questions.length > 0 && (
                <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                  Rhai asks
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Person drawer
// ---------------------------------------------------------------------------

export function PersonDrawer({
  person: initial,
  onClose
}: {
  person: RhaiPerson;
  onClose: () => void;
}) {
  const authedFetch = useAuthedFetch();
  const [person, setPerson] = useState(initial);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState<'idle' | 'saving' | 'researching'>('idle');
  const [showLog, setShowLog] = useState(false);
  const voice = useVoice(t => setNotes(n => (n ? n + ' ' + t : t)));

  useEffect(() => {
    setPerson(initial);
    setNotes(initial.notes ?? '');
  }, [initial]);

  const patch = async (p: Record<string, unknown>) => {
    setBusy('saving');
    try {
      const res = await authedFetch(`/api/rhai/people/${person.id}`, {
        method: 'PATCH',
        body: JSON.stringify(p)
      });
      if (res.ok) {
        const fresh = ((await res.json()) as { person: RhaiPerson }).person;
        setPerson(fresh);
        window.dispatchEvent(new Event('rhai:peopleChanged'));
      }
    } finally {
      setBusy('idle');
    }
  };

  const research = async (extra?: string) => {
    if (voice.listening) voice.toggle();
    if (extra?.trim()) await patch({ logNote: extra.trim() });
    setBusy('researching');
    try {
      const res = await authedFetch(`/api/rhai/people/${person.id}/research`, { method: 'POST' });
      if (res.ok) {
        setPerson(((await res.json()) as { person: RhaiPerson }).person);
        window.dispatchEvent(new Event('rhai:peopleChanged'));
      }
    } finally {
      setBusy('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/20" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto border-l border-ink-200 bg-cream-50 p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">{PERSON_TIER_LABELS[person.tier]}</p>
            <h2 className="mt-1 font-display text-2xl tracking-tight text-ink-900">{person.name}</h2>
            {person.headline && <p className="mt-0.5 text-sm text-ink-600">{person.headline}</p>}
            <p className="mt-0.5 text-xs text-ink-400">
              {[person.company, person.city].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-ink-400 hover:bg-ink-100">
            ✕
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => research()}
            disabled={busy !== 'idle'}
            className="rounded-md bg-ink-900 px-3 py-1.5 text-xs font-medium text-cream hover:bg-ink-800 disabled:opacity-60"
          >
            {busy === 'researching' ? 'Researching…' : person.summary ? '↻ Re-research' : '✨ Rhai, research them'}
          </button>
          <select
            value={person.tier}
            onChange={e => patch({ tier: e.target.value })}
            className="rounded-md border border-ink-200 bg-white px-2 py-1.5 text-xs text-ink-700"
          >
            {TIER_ORDER.map(t => (
              <option key={t} value={t}>
                {PERSON_TIER_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {person.questions && person.questions.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="eyebrow text-amber-700">Rhai needs from you</p>
            <ul className="mt-1 list-disc pl-5 text-xs text-amber-900">
              {person.questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && answer.trim() && (research(answer), setAnswer(''))}
                placeholder="Answer (full name, LinkedIn URL…) — Enter re-runs research"
                className="flex-1 rounded border border-amber-200 bg-white px-2 py-1.5 text-xs focus:outline-none"
              />
            </div>
          </div>
        )}

        {person.summary && (
          <div className="mb-4 rounded-lg border border-ink-200 bg-white p-3">
            <p className="eyebrow">Rhai&apos;s profile</p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink-700">{clean(person.summary)}</p>
            {person.links && person.links.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-2">
                {person.links.map(l => (
                  <a
                    key={l}
                    href={l}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-[11px] text-indigo-700 underline"
                  >
                    {l.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}
                  </a>
                ))}
              </p>
            )}
          </div>
        )}

        <ConnectionsSection person={person} onPatch={patch} />

        <div className="mb-4 rounded-lg border border-ink-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Your context</p>
            <div className="flex items-center gap-2">
              {voice.supported && (
                <button
                  type="button"
                  onClick={voice.toggle}
                  className={`rounded-full border px-2 py-1 text-xs ${
                    voice.listening
                      ? 'border-rose-300 bg-rose-50 text-rose-700'
                      : 'border-ink-200 text-ink-500 hover:bg-ink-50'
                  }`}
                  title="Dictate notes"
                >
                  {voice.listening ? '● rec' : '🎙'}
                </button>
              )}
              <button
                type="button"
                onClick={() => patch({ notes })}
                disabled={busy !== 'idle' || notes === (person.notes ?? '')}
                className="rounded-md border border-ink-200 px-2 py-1 text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-50"
              >
                {busy === 'saving' ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder="What you know about them — type or dictate…"
            className="mt-2 w-full rounded border border-ink-100 px-2 py-1.5 text-xs leading-relaxed text-ink-800 focus:border-ink-300 focus:outline-none"
          />
        </div>

        {person.notesLog && person.notesLog.length > 0 && (
          <div className="rounded-lg border border-ink-200 bg-white p-3">
            <button
              type="button"
              onClick={() => setShowLog(v => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <p className="eyebrow">Intel log · {person.notesLog.length}</p>
              <span className="text-xs text-ink-400">{showLog ? '▾' : '▸'}</span>
            </button>
            {showLog && (
              <ol className="mt-2 space-y-2">
                {[...person.notesLog].reverse().map((e, i) => (
                  <li key={i} className="border-l-2 border-ink-100 pl-2">
                    <p className="text-[10px] text-ink-400">
                      {new Date(e.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{' '}
                      · {e.source}
                    </p>
                    <p className="text-xs text-ink-700">{e.text}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connections — the relationship map. Who introduced them, mutuals, shared
// committees. Click a connection to jump to that person's drawer.
// ---------------------------------------------------------------------------

function ConnectionsSection({
  person,
  onPatch
}: {
  person: RhaiPerson;
  onPatch: (p: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState('');
  const [rel, setRel] = useState('');
  const connections = person.connections ?? [];

  const add = () => {
    if (!name.trim() || !rel.trim()) return;
    const next: PersonConnection[] = [...connections, { name: name.trim(), relationship: rel.trim() }];
    onPatch({ connections: next });
    setName('');
    setRel('');
  };
  const remove = (i: number) => onPatch({ connections: connections.filter((_, idx) => idx !== i) });

  return (
    <div className="mb-4 rounded-lg border border-ink-200 bg-white p-3">
      <p className="eyebrow">Connections</p>
      {person.introducedBy && (
        <p className="mt-1 text-xs text-ink-700">
          Introduced by{' '}
          <button type="button" onClick={() => openPerson(person.introducedBy!)} className="font-medium text-indigo-700 hover:underline">
            {person.introducedBy}
          </button>
        </p>
      )}
      {connections.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {connections.map((c, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <button type="button" onClick={() => openPerson(c.name)} className="font-medium text-indigo-700 hover:underline">
                {c.name}
              </button>
              <span className="text-ink-400">·</span>
              <span className="text-ink-600">{c.relationship}</span>
              {c.note && <span className="text-ink-400">— {c.note}</span>}
              <button type="button" onClick={() => remove(i)} className="ml-auto text-ink-300 hover:text-rose-600">
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[11px] text-ink-400">
          No connections mapped yet. Research fills these in; add your own below.
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Who"
          className="min-w-[100px] flex-1 rounded border border-ink-100 px-2 py-1 text-xs focus:border-ink-300 focus:outline-none"
        />
        <input
          type="text"
          value={rel}
          onChange={e => setRel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="How — introduced us / mutual / same YPO forum"
          className="min-w-[140px] flex-[2] rounded border border-ink-100 px-2 py-1 text-xs focus:border-ink-300 focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={!name.trim() || !rel.trim()}
          className="rounded border border-ink-200 px-2 py-1 text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-40"
        >
          + Link
        </button>
      </div>
    </div>
  );
}
