'use client';

// /rooms — Rhea's list of transcript rooms and the "open a room" form.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { HostRoomView } from '@/lib/rooms/types';
import { roomDateLabel } from '@/lib/rooms/types';
import { useAuth } from '../AuthProvider';
import { useAuthedFetch } from '../useAuthedFetch';
import { LeadSelect, useLeadOptions } from './shared';

export function RoomsHome() {
  const { user, signIn, loading } = useAuth();
  const authedFetch = useAuthedFetch();
  const router = useRouter();
  const [rooms, setRooms] = useState<HostRoomView[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [name, setName] = useState('');
  const [leadId, setLeadId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leads = useLeadOptions(!!user && !denied);

  const load = useCallback(async () => {
    const r = await authedFetch('/api/rooms').catch(() => null);
    if (r?.status === 401 || r?.status === 403) {
      setDenied(true);
      return;
    }
    if (r?.ok) setRooms(((await r.json()) as { rooms: HostRoomView[] }).rooms);
  }, [authedFetch]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    const r = await authedFetch('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), leadId: leadId || null })
    }).catch(() => null);
    setCreating(false);
    if (!r?.ok) {
      setError(r ? await r.text() : 'Could not create the room.');
      return;
    }
    const { room } = (await r.json()) as { room: HostRoomView };
    router.push(`/rooms/${room.id}`);
  };

  if (loading) return <div className="p-10 text-sm text-ink-400">…</div>;
  if (!user || denied) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-display text-3xl text-ink-900">Rooms</h1>
        <p className="mt-3 text-sm text-ink-500">Sign in with your operator account to open a transcript room.</p>
        <button
          type="button"
          onClick={() => signIn().then(() => setDenied(false)).catch(() => undefined)}
          className="mt-6 rounded-md bg-ink-900 px-4 py-2 text-sm text-cream"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-[11px] uppercase tracking-eyebrow text-ink-400">In-person transcription</p>
      <h1 className="mt-1 font-display text-3xl text-ink-900">Rooms</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-500">
        Open a room, put the QR code up, and everyone joins on their phone by name. Each person taps to talk; you get
        one transcript with who said what.
      </p>

      <form
        className="mt-8 rounded-2xl border border-ink-200/80 bg-white/70 p-5"
        onSubmit={e => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
          <label className="block">
            <span className="text-xs font-medium text-ink-600">Room name</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Kothari leadership offsite — round 1"
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-ink-500"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-600">Rhai client (optional)</span>
            <div className="mt-1">
              <LeadSelect value={leadId} onChange={setLeadId} options={leads} />
            </div>
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-accent">{error}</p>}
        <button
          type="submit"
          disabled={!name.trim() || creating}
          className="mt-4 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-cream disabled:opacity-40"
        >
          {creating ? 'Opening…' : 'Open room'}
        </button>
      </form>

      <div className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-eyebrow text-ink-400">Your rooms</h2>
        {rooms === null ? (
          <p className="mt-4 text-sm text-ink-400">Loading…</p>
        ) : rooms.length === 0 ? (
          <p className="mt-4 text-sm text-ink-400">No rooms yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-200/70 rounded-2xl border border-ink-200/80 bg-white/70">
            {rooms.map(r => (
              <li key={r.id}>
                <Link href={`/rooms/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${r.status === 'open' ? 'bg-emerald-500' : 'bg-ink-200'}`}
                    aria-label={r.status}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">{r.name}</span>
                    <span className="block truncate text-xs text-ink-400">
                      {roomDateLabel(r.createdAt)} · {r.participants.length} {r.participants.length === 1 ? 'person' : 'people'}
                      {r.leadLabel ? ` · ${r.leadLabel}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-400">{r.status === 'open' ? 'Live' : 'Ended'}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
