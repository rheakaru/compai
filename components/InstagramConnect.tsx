'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useAuthedFetch } from './useAuthedFetch';

// Operator-only card at the foot of /instagram: paste the Instagram access
// token once to connect the feed. Renders nothing for the public.

interface Status {
  connected: boolean;
  username: string | null;
  postCount: number;
  fetchedAt: number | null;
  lastError: string | null;
}

export function InstagramConnect() {
  const { user } = useAuth();
  const authedFetch = useAuthedFetch();
  const [status, setStatus] = useState<Status | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const res = await authedFetch('/api/rhai/instagram').catch(() => null);
      if (res?.ok) setStatus((await res.json()) as Status);
    })();
  }, [user, authedFetch]);

  if (!user || !status) return null;

  const connect = async () => {
    setBusy(true);
    setMessage(null);
    const res = await authedFetch('/api/rhai/instagram', { method: 'POST', body: JSON.stringify({ token }) }).catch(
      () => null
    );
    if (res?.ok) {
      const d = (await res.json()) as { username: string; postCount: number };
      setToken('');
      setMessage(`Connected @${d.username} — ${d.postCount} posts pulled. Reload to see them.`);
      setStatus({ connected: true, username: d.username, postCount: d.postCount, fetchedAt: Date.now(), lastError: null });
    } else {
      setMessage((await res?.text()) || 'Could not connect.');
    }
    setBusy(false);
  };

  return (
    <section className="border-t border-ink-200/60 bg-cream-50">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="eyebrow">Only you can see this</p>
        <p className="mt-2 text-sm text-ink-700">
          {status.connected
            ? `Instagram is connected${status.username ? ` as @${status.username}` : ''} — ${status.postCount} posts cached. The token renews itself.`
            : 'Instagram is not connected yet. Paste a long-lived Instagram access token to pull your posts onto the site.'}
        </p>
        {status.lastError && <p className="mt-2 text-xs text-rose-500">Last fetch failed: {status.lastError}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder={status.connected ? 'Paste a new token to replace it' : 'Instagram access token'}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900"
          />
          <button
            type="button"
            onClick={connect}
            disabled={busy || !token.trim()}
            className="rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-cream hover:bg-ink-800 disabled:opacity-50"
          >
            {busy ? 'Connecting…' : status.connected ? 'Replace token' : 'Connect'}
          </button>
        </div>
        {message && <p className="mt-3 text-xs text-ink-600">{message}</p>}
      </div>
    </section>
  );
}
