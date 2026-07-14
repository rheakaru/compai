'use client';

// The launch-party guest list — every RSVP from heyrhai.com/party as it lands.
// Headcount up top, copyable list for the door, newest first.

import { useEffect, useState } from 'react';
import { useAuthedFetch } from './useAuthedFetch';
import type { PartyRsvp } from '@/lib/rhai/rsvp';

export function RsvpPanel() {
  const authedFetch = useAuthedFetch();
  const [items, setItems] = useState<PartyRsvp[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    authedFetch('/api/rsvp')
      .then(async res => {
        if (res.ok) setItems(((await res.json()) as { rsvps: PartyRsvp[] }).rsvps);
      })
      .catch(() => undefined);
  }, [authedFetch]);

  if (items === null) return <p className="text-sm text-ink-400">Loading…</p>;
  if (items.length === 0)
    return (
      <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
        No RSVPs yet — share <span className="font-mono text-ink-600">heyrhai.com/party</span> with the invite list.
      </p>
    );

  const heads = items.reduce((s, r) => s + r.guests, 0);

  const copyList = async () => {
    const text = items.map(r => `${r.name} — ${r.contact}${r.guests === 2 ? ' (+1)' : ''}`).join('\n');
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="card flex items-baseline gap-2 !py-3">
          <span className="display text-3xl text-ink-900">{heads}</span>
          <span className="text-xs text-ink-500">
            heads · {items.length} RSVP{items.length === 1 ? '' : 's'}
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
          Invite link: <span className="font-mono text-ink-600">heyrhai.com/party</span>
        </span>
      </div>

      <div className="space-y-2">
        {items.map(r => (
          <div key={r.id} className="card flex flex-wrap items-baseline gap-x-4 gap-y-1 !py-3">
            <span className="font-medium text-ink-900">{r.name}</span>
            <span className="font-mono text-xs text-ink-500">{r.contact}</span>
            {r.guests === 2 && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">+1</span>}
            {r.note && <span className="text-xs text-ink-500">“{r.note}”</span>}
            <span className="ml-auto text-[11px] text-ink-300">
              {new Date(r.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
