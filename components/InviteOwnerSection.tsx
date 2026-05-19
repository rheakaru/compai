'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import type { RoleAggregate } from '@/lib/role/aggregate';

export function InviteOwnerSection({ companyId }: { companyId: string }) {
  const { user, getToken } = useAuth();
  const [aggregate, setAggregate] = useState<RoleAggregate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [roleTitle, setRoleTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/companies/${companyId}/roles/aggregate`, {
        headers: token ? { authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RoleAggregate;
      setAggregate(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [user, companyId, getToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTitle.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ companyId, roleTitle: roleTitle.trim() })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      setRoleTitle('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (inviteToken: string) => {
    const link = `${window.location.origin}/invite/${inviteToken}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(inviteToken);
      setTimeout(() => setCopiedToken(null), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  if (!user) {
    return (
      <div className="card">
        <p className="text-sm text-ink-600">
          Sign in to invite coworkers and see the role-automation aggregate.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form onSubmit={createInvite} className="card">
        <h3 className="text-sm font-semibold text-ink-900">Invite a coworker</h3>
        <p className="mt-1 text-xs text-ink-500">
          They get a private link to describe their role. They see a career strategy. You see only
          the aggregate — never their individual answers.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={roleTitle}
            onChange={e => setRoleTitle(e.target.value)}
            placeholder="Role title — e.g. Ops Manager"
            className="flex-1 rounded border border-ink-200 bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={creating || !roleTitle.trim()}
            className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:bg-ink-300"
            style={{ backgroundColor: creating ? undefined : 'var(--brand, #c64a1f)' }}
          >
            {creating ? 'Creating…' : 'Generate link'}
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">
            {error}
          </p>
        )}
      </form>

      {aggregate && aggregate.rolesInvited > 0 && (
        <>
          <AggregateMetrics aggregate={aggregate} />
          <Roster aggregate={aggregate} onCopy={copyLink} copiedToken={copiedToken} />
        </>
      )}
      {aggregate && aggregate.rolesInvited === 0 && !loading && (
        <p className="text-xs text-ink-400">No invites yet.</p>
      )}
    </div>
  );
}

function AggregateMetrics({ aggregate }: { aggregate: RoleAggregate }) {
  const pct =
    aggregate.averageTranslationShare !== null
      ? Math.round(aggregate.averageTranslationShare * 100)
      : null;

  return (
    <div className="card">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        Role-automation aggregate
      </h3>
      <p className="mt-1 text-[11px] text-ink-400">
        Computed only across completed roles. Per-invitee substance is never shown here — that
        would break the trust invariant that keeps invitee descriptions honest.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Metric label="Invited" value={String(aggregate.rolesInvited)} />
        <Metric label="Completed" value={String(aggregate.rolesCompleted)} />
        <Metric
          label="Avg translation surface"
          value={pct === null ? '—' : `${pct}%`}
        />
      </div>
      {aggregate.rolesCompleted > 0 && (
        <>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full"
              style={{
                width: `${pct ?? 0}%`,
                backgroundColor: 'var(--brand, #c64a1f)',
                opacity: 0.55
              }}
            />
          </div>
          <p className="mt-3 text-xs text-ink-600">
            <span className="font-medium text-ink-900">
              {aggregate.translationHeavyRoleCount}
            </span>{' '}
            translation-heavy {aggregate.translationHeavyRoleCount === 1 ? 'role' : 'roles'} ·{' '}
            <span className="font-medium text-ink-900">
              {aggregate.judgementHeavyRoleCount}
            </span>{' '}
            judgement-heavy.
          </p>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function Roster({
  aggregate,
  onCopy,
  copiedToken
}: {
  aggregate: RoleAggregate;
  onCopy: (token: string) => void;
  copiedToken: string | null;
}) {
  return (
    <div className="card">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        Roster
      </h3>
      <p className="mt-1 text-[11px] text-ink-400">
        Role titles and invitee status. Never their answers.
      </p>
      <ul className="mt-3 divide-y divide-ink-100">
        {aggregate.roster.map(r => (
          <li key={r.roleId} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-900">{r.roleTitle}</p>
              <p className="truncate text-xs text-ink-500">{r.inviteeEmail ?? 'no sign-in yet'}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={r.status} />
              {r.status !== 'completed' && (
                <button
                  type="button"
                  onClick={() => onCopy(r.inviteToken)}
                  className="rounded border border-ink-200 px-2 py-0.5 text-[11px] uppercase tracking-wide text-ink-500 hover:bg-ink-50 hover:text-ink-800"
                >
                  {copiedToken === r.inviteToken ? 'copied' : 'copy link'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: 'pending' | 'started' | 'completed' }) {
  const cls =
    status === 'completed'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'started'
        ? 'bg-amber-100 text-amber-900'
        : 'bg-ink-100 text-ink-700';
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{status}</span>
  );
}
