'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';

interface Journey {
  sessionId: string;
  ownerUid: string | null;
  email: string | null;
  companyIds: string[];
  companyUrls: string[];
  furthestStage: string;
  firstSeen: number;
  lastSeen: number;
  stackSummary: string | null;
  analogyFloorCleared: boolean | null;
}

const STAGE_LABELS: Record<string, string> = {
  url_submitted: 'URL',
  profile_viewed: 'Viewed',
  edit_started: 'Edit started',
  edit_blocked_by_auth: 'Auth gate hit',
  signed_in: 'Signed in',
  edit_saved: 'Edit saved',
  analogy_floor_cleared: 'Analogy ≥ floor',
  analogy_honest_stop: 'Honest stop',
  projects_requested: 'Projects req',
  stack_submitted: 'Stack ✓',
  projects_viewed: 'Projects seen'
};

export function AdminFunnelClient() {
  const { user, getToken, signIn } = useAuth();
  const [journeys, setJourneys] = useState<Journey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const res = await fetch('/api/admin/funnel', {
          headers: token ? { authorization: `Bearer ${token}` } : {}
        });
        if (res.status === 403) {
          setError("You're signed in, but this account is not the operator. Ask Rhea to grant operator:true.");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { journeys: Journey[] };
        setJourneys(data.journeys);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [user, getToken]);

  if (!user) {
    return (
      <Wrapper>
        <p className="text-ink-700">Sign in with the operator account to view the funnel.</p>
        <button
          type="button"
          onClick={() => signIn().catch(() => undefined)}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
        >
          Sign in with Google
        </button>
      </Wrapper>
    );
  }

  if (loading) return <Wrapper><p className="text-ink-500">Loading…</p></Wrapper>;

  if (error) {
    return (
      <Wrapper>
        <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </p>
      </Wrapper>
    );
  }

  if (!journeys || journeys.length === 0) {
    return (
      <Wrapper>
        <p className="text-ink-500">No funnel events yet.</p>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <p className="mb-4 text-xs text-ink-500">{journeys.length} journeys, most recent first.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-200 text-left text-[11px] uppercase tracking-wider text-ink-500">
            <tr>
              <th className="py-2 pr-3">Last seen</th>
              <th className="py-2 pr-3">URL</th>
              <th className="py-2 pr-3">Stage</th>
              <th className="py-2 pr-3">Signed in?</th>
              <th className="py-2 pr-3">Stack</th>
              <th className="py-2 pr-3">Analogy</th>
            </tr>
          </thead>
          <tbody>
            {journeys.map(j => (
              <tr key={j.sessionId} className="border-b border-ink-100">
                <td className="py-2 pr-3 text-xs text-ink-500">{formatTime(j.lastSeen)}</td>
                <td className="py-2 pr-3 font-mono text-xs">
                  {j.companyUrls.length > 0 ? (
                    <a
                      href={j.companyIds[0] ? `/c/${j.companyIds[0]}` : '#'}
                      className="text-ink-800 hover:underline"
                    >
                      {j.companyUrls[j.companyUrls.length - 1]}
                    </a>
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <StageBadge stage={j.furthestStage} />
                </td>
                <td className="py-2 pr-3 text-xs text-ink-700">
                  {j.email ?? (j.ownerUid ? 'yes' : '—')}
                </td>
                <td className="py-2 pr-3 text-xs text-ink-700">{j.stackSummary ?? '—'}</td>
                <td className="py-2 pr-3 text-xs">
                  {j.analogyFloorCleared === true ? (
                    <span className="text-emerald-700">≥ floor</span>
                  ) : j.analogyFloorCleared === false ? (
                    <span className="text-amber-700">honest stop</span>
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Funnel</h1>
      <p className="mt-1 text-sm text-ink-500">
        Operator view of every session that touched compAI. Pre-auth rows stitch to ownerUid on sign-in.
      </p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const label = STAGE_LABELS[stage] ?? stage;
  const isStop = stage === 'analogy_honest_stop';
  const isProjects = stage === 'projects_viewed';
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
        isProjects
          ? 'bg-emerald-100 text-emerald-800'
          : isStop
            ? 'bg-amber-100 text-amber-900'
            : 'bg-ink-100 text-ink-800'
      }`}
    >
      {label}
    </span>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const ago = now - ts;
  if (ago < 60_000) return `${Math.round(ago / 1000)}s ago`;
  if (ago < 3600_000) return `${Math.round(ago / 60_000)}m ago`;
  if (ago < 86400_000) return `${Math.round(ago / 3600_000)}h ago`;
  return d.toLocaleDateString();
}
