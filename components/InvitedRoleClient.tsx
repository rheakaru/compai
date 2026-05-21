'use client';

import { useCallback, useMemo, useState } from 'react';
import { BrandHeader } from './BrandHeader';
import { CareerStrategyView } from './CareerStrategyView';
import { ActivityStream } from './ActivityStream';
import type { BrandingSnapshot } from '@/lib/model/claims';
import type {
  CareerStrategyClaim,
  RoleActivityClaim,
  RoleClaim,
  RoleStatus
} from '@/lib/model/role';

type Phase = 'input' | 'streaming' | 'done';

export function InvitedRoleClient({
  token,
  roleTitle,
  status,
  companyName,
  companyUrl,
  branding,
  initialClaims
}: {
  token: string;
  roleTitle: string;
  status: RoleStatus;
  companyName: string | null;
  companyUrl: string | null;
  branding: BrandingSnapshot | null;
  initialClaims: RoleClaim[];
}) {
  const initialPhase: Phase = status === 'completed' ? 'done' : 'input';
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [sourceOfTruthDoc, setSourceOfTruthDoc] = useState('');
  const [description, setDescription] = useState('');
  const [claims, setClaims] = useState<RoleClaim[]>(initialClaims);
  const [error, setError] = useState<string | null>(null);

  const activities = useMemo(
    () =>
      claims.filter(
        (c): c is RoleActivityClaim => c.kind === 'role_activity' && c.supersededBy === null
      ),
    [claims]
  );
  const careerStrategy = useMemo(() => {
    const all = claims.filter(
      (c): c is CareerStrategyClaim => c.kind === 'career_strategy' && c.supersededBy === null
    );
    return all.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  }, [claims]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (description.trim().length < 20) {
        setError('Tell us a little more — a few sentences about what your day looks like.');
        return;
      }
      setError(null);
      setPhase('streaming');
      setClaims([]);

      try {
        const res = await fetch('/api/roles/derive', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token,
            description: description.trim(),
            sourceOfTruthDoc: sourceOfTruthDoc.trim() || undefined
          })
        });
        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `HTTP ${res.status}`);
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
              try {
                const ev = JSON.parse(line.slice(6));
                if (ev.type === 'claim' && ev.claim) {
                  setClaims(prev => [...prev, ev.claim as RoleClaim]);
                } else if (ev.type === 'error') {
                  setError(typeof ev.message === 'string' ? ev.message : 'agent error');
                }
              } catch {
                // ignore malformed line
              }
            }
          }
        }
        setPhase('done');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase('input');
      }
    },
    [description, sourceOfTruthDoc, token]
  );

  const brandStyle = {
    '--brand': branding?.accentColor ?? '#c64a1f'
  } as React.CSSProperties;

  return (
    <div className="min-h-screen" style={brandStyle}>
      <BrandHeader url={companyUrl} branding={branding} />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-wider text-ink-500">Invited to compAI</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">
            {roleTitle}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {companyName ? `at ${companyName}` : ''}
          </p>
        </div>

        {phase === 'input' && (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="card">
              <p className="text-[15px] leading-relaxed text-ink-800">
                You&apos;ve been asked to describe your role. The output you&apos;ll see is a{' '}
                <span className="font-semibold">career strategy</span> — concrete moves you can
                make over the next few quarters, framed around what AI is genuinely changing in
                your kind of work.
              </p>
              <p className="mt-3 text-sm text-ink-600">
                Honest descriptions produce useful strategies. Inflated ones produce useless ones.
                The polished strategy you see at the end <span className="font-medium">is visible to the person who invited you</span> — they don&apos;t see the raw text you wrote here, but they do see the analysis of your role. If you&apos;d rather keep something private, leave it out.
              </p>
            </div>

            <div
              className="card border-l-4"
              style={{ borderLeftColor: 'var(--brand, #c64a1f)' }}
            >
              <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-700">
                Start here
              </label>
              <p className="mt-1 text-[16px] font-semibold leading-snug text-ink-900">
                What is the one document you cannot do your job without?
              </p>
              <p className="mt-1 text-xs text-ink-500">
                Name the file by name — a spreadsheet, an SOP, a shared doc, a tracker.
                This is the most useful thing you can tell us. The leverage is right there.
              </p>
              <input
                value={sourceOfTruthDoc}
                onChange={e => setSourceOfTruthDoc(e.target.value)}
                className="mt-3 w-full rounded-md border border-ink-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none placeholder:text-ink-300 focus:border-ink-400"
                placeholder="e.g. ProductionTracker.xlsx — the master schedule one engineer keeps"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-ink-500">
                And then — what does a normal day or week look like?
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={9}
                className="mt-1 w-full resize-none rounded-md border border-ink-200 bg-white px-4 py-3 text-sm shadow-sm outline-none placeholder:text-ink-300 focus:border-ink-400"
                placeholder={[
                  "Be specific. What do you actually do?",
                  "What documents do you read and produce?",
                  "What decisions land on your desk?",
                  "Who do you coordinate with and how?",
                  "What problems take up the most of your time?"
                ].join('\n')}
              />
            </div>
            <button
              type="submit"
              disabled={description.trim().length < 20}
              className="w-full rounded-md px-4 py-3 text-base font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:bg-ink-300"
              style={{
                backgroundColor: description.trim().length < 20 ? undefined : 'var(--brand, #c64a1f)'
              }}
            >
              See my career strategy
            </button>
            {error && (
              <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {error}
              </p>
            )}
          </form>
        )}

        {phase === 'streaming' && (
          <div className="space-y-6">
            <p className="text-sm text-ink-500">Reading your role…</p>
            <ActivityStream activities={activities} />
            {careerStrategy && <CareerStrategyView strategy={careerStrategy.content} />}
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-8">
            {careerStrategy ? (
              <CareerStrategyView strategy={careerStrategy.content} />
            ) : (
              <p className="text-sm text-ink-500">
                Strategy not generated yet — try refreshing in a moment.
              </p>
            )}
            <ActivityStream activities={activities} />
          </div>
        )}
      </div>
    </div>
  );
}
