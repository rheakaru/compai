'use client';

// The launch-party guest list. Two streams share it:
//  • Requests (from /join) — pending, with Approve / Decline. Approving unlocks
//    the venue on the requester's page.
//  • Guests (from /party, plus approved requests) — the confirmed headcount.

import { useCallback, useEffect, useState } from 'react';
import { useAuthedFetch } from './useAuthedFetch';
import { IS_GOING, type PartyRsvp, type RsvpStatus } from '@/lib/rhai/rsvp';

export function RsvpPanel() {
  const authedFetch = useAuthedFetch();
  const [items, setItems] = useState<PartyRsvp[] | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await authedFetch('/api/rsvp');
    if (res.ok) setItems(((await res.json()) as { rsvps: PartyRsvp[] }).rsvps);
  }, [authedFetch]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const setStatus = async (id: string, status: RsvpStatus) => {
    setItems(prev => (prev ? prev.map(r => (r.id === id ? { ...r, status } : r)) : prev));
    await authedFetch('/api/rsvp', { method: 'PATCH', body: JSON.stringify({ id, status }) }).catch(() => undefined);
    load().catch(() => undefined);
  };

  if (items === null) return <p className="text-sm text-ink-400">Loading…</p>;
  if (items.length === 0)
    return (
      <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
        Nothing yet. Share <span className="font-mono text-ink-600">heyrhai.com/party</span> with the guest list, or{' '}
        <span className="font-mono text-ink-600">heyrhai.com/join</span> with the broader community.
      </p>
    );

  const pending = items.filter(r => r.status === 'pending');
  const going = items.filter(r => IS_GOING(r.status));
  const declined = items.filter(r => r.status === 'declined');
  const heads = going.reduce((s, r) => s + r.guests, 0);

  const copyList = async () => {
    const text = going.map(r => `${r.name} — ${r.contact}${r.guests === 2 ? ' (+1)' : ''}`).join('\n');
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const when = (t: number) =>
    new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <div className="space-y-6">
      {/* Requests awaiting approval */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-medium text-ink-900">Requests to approve</h3>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">{pending.length}</span>
          </div>
          {pending.map(r => (
            <div key={r.id} className="card space-y-2 !py-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-medium text-ink-900">{r.name}</span>
                <span className="font-mono text-xs text-ink-500">{r.contact}</span>
                {r.guests === 2 && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">+1</span>}
                <span className="ml-auto text-[11px] text-ink-300">{when(r.createdAt)}</span>
              </div>
              {r.note && <p className="text-xs italic text-ink-500">“{r.note}”</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStatus(r.id, 'approved')}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-600"
                >
                  Approve → unlocks details
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(r.id, 'declined')}
                  className="rounded-md border border-ink-200 px-3 py-1.5 text-xs text-ink-500 hover:text-ink-800"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmed headcount */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="card flex items-baseline gap-2 !py-3">
          <span className="display text-3xl text-ink-900">{heads}</span>
          <span className="text-xs text-ink-500">
            heads · {going.length} going
          </span>
        </div>
        <button
          type="button"
          onClick={copyList}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-xs text-ink-600 hover:text-ink-900"
        >
          {copied ? 'Copied ✓' : 'Copy guest list'}
        </button>
        <span className="text-xs text-ink-400">
          Invite: <span className="font-mono text-ink-600">/party</span> · Request: <span className="font-mono text-ink-600">/join</span>
        </span>
      </div>

      <div className="space-y-2">
        {going.map(r => (
          <div key={r.id} className="card flex flex-wrap items-baseline gap-x-4 gap-y-1 !py-3">
            <span className="font-medium text-ink-900">{r.name}</span>
            <span className="font-mono text-xs text-ink-500">{r.contact}</span>
            {r.guests === 2 && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">+1</span>}
            {r.list === 'request' && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500">approved</span>}
            {r.note && <span className="text-xs text-ink-500">“{r.note}”</span>}
            <span className="ml-auto text-[11px] text-ink-300">{when(r.createdAt)}</span>
          </div>
        ))}
      </div>

      {declined.length > 0 && (
        <details className="text-xs text-ink-400">
          <summary className="cursor-pointer">{declined.length} declined</summary>
          <div className="mt-2 space-y-1">
            {declined.map(r => (
              <div key={r.id} className="flex items-baseline gap-3">
                <span className="text-ink-500 line-through">{r.name}</span>
                <span className="font-mono text-ink-400">{r.contact}</span>
                <button type="button" onClick={() => setStatus(r.id, 'approved')} className="ml-auto text-accent hover:underline">
                  approve instead
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
