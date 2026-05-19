'use client';

import { useCallback, useRef, useState } from 'react';
import type { BrandingSnapshot, Claim } from '@/lib/model/claims';
import type { Ontology } from '@/lib/ontology/types';
import { Profile, type ProfileHandle } from './Profile';

type Status = 'idle' | 'streaming' | 'done' | 'error';

export function LandingClient({ ontology }: { ontology: Ontology }) {
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [showProfile, setShowProfile] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyUrl, setCompanyUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [initialClaims, setInitialClaims] = useState<Claim[]>([]);
  const [initialBranding, setInitialBranding] = useState<BrandingSnapshot | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const profileRef = useRef<ProfileHandle | null>(null);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!url.trim()) return;
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setStatus('streaming');
      setInitialClaims([]);
      setShowProfile(true);
      setErrorMsg(null);

      try {
        const res = await fetch('/api/research', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: url.trim(), notes: notes.trim() || undefined }),
          signal: ctrl.signal
        });

        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `HTTP ${res.status}`);
        }

        // Cache hit: server already has a completed analysis for this URL +
        // user/session. Redirect to it instead of re-running the agent.
        const ctype = res.headers.get('content-type') ?? '';
        if (ctype.includes('application/json')) {
          const data = (await res.json()) as { companyId?: string; alreadyCompleted?: boolean };
          if (data.companyId) {
            window.location.href = `/c/${data.companyId}`;
            return;
          }
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = buffer.indexOf('\n\n')) !== -1) {
            const chunk = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 2);
            const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
            for (const line of lines) {
              const json = line.slice(6);
              try {
                const ev = JSON.parse(json);
                handleEvent(ev);
              } catch {
                // ignore malformed
              }
            }
          }
        }
        setStatus('done');
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    },
    [url, notes]
  );

  const handleEvent = (ev: { type: string; [k: string]: unknown }) => {
    if (ev.type === 'company_created' && typeof ev.companyId === 'string') {
      setCompanyId(ev.companyId);
      setCompanyUrl(url.trim());
      try {
        window.history.replaceState({}, '', `/c/${ev.companyId}`);
      } catch {
        // ignore
      }
    } else if (ev.type === 'claim' && ev.claim) {
      const claim = ev.claim as Claim;
      if (profileRef.current) {
        profileRef.current.appendClaim(claim);
      } else {
        setInitialClaims(prev => [...prev, claim]);
      }
    } else if (ev.type === 'branding' && ev.branding) {
      const b = ev.branding as BrandingSnapshot;
      if (profileRef.current) {
        profileRef.current.setBranding(b);
      } else {
        setInitialBranding(b);
      }
    } else if (ev.type === 'error' && typeof ev.message === 'string') {
      setErrorMsg(ev.message);
    }
  };

  if (!showProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
            See your company&apos;s shape.
          </h1>
          <p className="mt-3 text-ink-600">
            Paste a URL. We&apos;ll read the structural axes that decide what&apos;s hard for you,
            and show our evidence. The point is to be sharp — and to stop honestly where we stop seeing.
          </p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="hoovufresh.com"
              className="w-full rounded-md border border-ink-200 bg-white px-4 py-3 text-base shadow-sm outline-none placeholder:text-ink-300 focus:border-ink-400"
              required
              autoFocus
            />
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional: anything the website won't say (a real SOP, pricing detail, who you actually sell to)."
              rows={3}
              className="w-full resize-none rounded-md border border-ink-200 bg-white px-4 py-3 text-sm shadow-sm outline-none placeholder:text-ink-300 focus:border-ink-400"
            />
            <button
              type="submit"
              disabled={!url.trim()}
              className="w-full rounded-md bg-accent px-4 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:bg-ink-300"
            >
              Read the shape
            </button>
          </form>
          {errorMsg && (
            <p className="mt-4 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {errorMsg}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <Profile
      ref={profileRef}
      initialClaims={initialClaims}
      ontology={ontology}
      companyId={companyId}
      companyUrl={companyUrl}
      streaming={status === 'streaming'}
      initialBranding={initialBranding}
    />
  );
}
