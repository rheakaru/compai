'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// The email gate in front of a shared doc: one field, no password. On submit
// the server sets a viewer cookie and the page re-renders with the document.

export function EmailGate({ slug, title, description, author }: { slug: string; title: string; description: string; author: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Count the visit to the gate itself, so people who leave without entering
  // an email still show up (anonymously) in the operator view.
  useEffect(() => {
    void fetch(`/api/shared/${slug}/visit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ referrer: document.referrer }),
      keepalive: true
    }).catch(() => undefined);
  }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/shared/${slug}/access`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email })
    }).catch(() => null);
    if (res?.ok) {
      router.refresh();
      return;
    }
    setError((await res?.text()) || 'Something went wrong — try again.');
    setBusy(false);
  };

  return (
    <div className="dc-gate">
      <form onSubmit={submit} className="dc-gate-card">
        <p className="eyebrow">Shared by {author}</p>
        <h1 className="dc-gate-title">{title}</h1>
        <p className="dc-gate-desc">{description}</p>
        <label htmlFor="dc-email" className="dc-gate-label">
          Enter your email to read it
        </label>
        <div className="dc-gate-row">
          <input
            id="dc-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="dc-gate-input"
          />
          <button type="submit" disabled={busy} className="dc-gate-btn">
            {busy ? 'Opening…' : 'Read'}
          </button>
        </div>
        {error && <p className="dc-gate-error">{error}</p>}
        <p className="dc-gate-note">No password or account. {author.split(' ')[0]} will see who has read this.</p>
      </form>
    </div>
  );
}
