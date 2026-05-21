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

interface CompanyRow {
  companyId: string;
  url: string;
  name: string | null;
  ownerUid: string | null;
  createdAt: number;
  completedAt: number | null;
  firstSeen: number;
  lastSeen: number;
  furthestStage: string | null;
  profileViews: number;
  editsStarted: number;
  editsSaved: number;
  exports: number;
  rolesInvited: number;
  rolesCompleted: number;
  signedInUsers: number;
  projectsGenerated: boolean;
  userNotesLength: number;
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
  projects_viewed: 'Projects seen',
  session_plan_viewed: 'Session viewed',
  session_plan_gate_passed: 'Session gate ✓',
  context_graph_exported: 'Exported'
};

type Tab = 'companies' | 'journeys';

export function AdminFunnelClient() {
  const { user, getToken, signIn } = useAuth();
  const [data, setData] = useState<{ journeys: Journey[]; companies: CompanyRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('companies');

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
        const d = (await res.json()) as { journeys: Journey[]; companies: CompanyRow[] };
        setData(d);
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

  if (!data) return <Wrapper><p className="text-ink-500">No data.</p></Wrapper>;

  const { journeys, companies } = data;

  // Top-line metrics across all companies.
  const totalCompanies = companies.length;
  const completedCompanies = companies.filter(c => c.completedAt).length;
  const totalExports = companies.reduce((a, c) => a + c.exports, 0);
  const totalRolesInvited = companies.reduce((a, c) => a + c.rolesInvited, 0);
  const totalRolesCompleted = companies.reduce((a, c) => a + c.rolesCompleted, 0);
  const companiesWithSignedInUsers = companies.filter(c => c.signedInUsers > 0).length;
  const totalProfileViews = companies.reduce((a, c) => a + c.profileViews, 0);
  const returnVisits = companies.filter(c => c.profileViews >= 2).length;

  return (
    <Wrapper>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Companies analyzed" value={String(totalCompanies)} sub={`${completedCompanies} completed`} />
        <Metric
          label="With a signed-in user"
          value={`${companiesWithSignedInUsers}`}
          sub={`${Math.round((companiesWithSignedInUsers / Math.max(1, totalCompanies)) * 100)}% of analyzed`}
        />
        <Metric
          label="Profile views"
          value={String(totalProfileViews)}
          sub={`${returnVisits} co. with ≥2 views`}
        />
        <Metric label="Exports" value={String(totalExports)} sub="LLM context downloaded" />
        <Metric label="Roles invited" value={String(totalRolesInvited)} sub={`${totalRolesCompleted} completed`} />
        <Metric label="Sessions" value={String(journeys.length)} sub="distinct sessions (any URL)" />
      </div>

      <div className="mb-4 flex gap-2">
        <TabBtn active={tab === 'companies'} onClick={() => setTab('companies')}>
          Companies · {companies.length}
        </TabBtn>
        <TabBtn active={tab === 'journeys'} onClick={() => setTab('journeys')}>
          Journeys · {journeys.length}
        </TabBtn>
      </div>

      {tab === 'companies' ? <CompaniesTable rows={companies} /> : <JourneysTable rows={journeys} />}
    </Wrapper>
  );
}

function CompaniesTable({ rows }: { rows: CompanyRow[] }) {
  if (rows.length === 0) return <p className="text-ink-500">No companies yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-ink-200 text-left text-[11px] uppercase tracking-wider text-ink-500">
          <tr>
            <th className="py-2 pr-3">Last seen</th>
            <th className="py-2 pr-3">Company</th>
            <th className="py-2 pr-3">Stage</th>
            <th className="py-2 pr-3 text-right">Views</th>
            <th className="py-2 pr-3 text-right">Edits</th>
            <th className="py-2 pr-3 text-right">Roles</th>
            <th className="py-2 pr-3 text-right">Signed-in</th>
            <th className="py-2 pr-3 text-right">Exports</th>
            <th className="py-2 pr-3">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(c => (
            <tr key={c.companyId} className="border-b border-ink-100">
              <td className="py-2 pr-3 text-xs text-ink-500">{formatTime(c.lastSeen)}</td>
              <td className="py-2 pr-3">
                <a
                  href={`/c/${c.companyId}`}
                  className="block max-w-[280px] truncate font-medium text-ink-900 hover:underline"
                  title={c.url}
                >
                  {c.name ?? c.url.replace(/^https?:\/\//, '')}
                </a>
                <p className="truncate text-[11px] text-ink-400">{c.url}</p>
              </td>
              <td className="py-2 pr-3">
                <StageBadge stage={c.furthestStage} />
              </td>
              <td className="py-2 pr-3 text-right text-xs text-ink-700">{c.profileViews}</td>
              <td className="py-2 pr-3 text-right text-xs text-ink-700">
                {c.editsSaved}
                {c.editsStarted > c.editsSaved && (
                  <span className="ml-1 text-[10px] text-ink-400">+{c.editsStarted - c.editsSaved} started</span>
                )}
              </td>
              <td className="py-2 pr-3 text-right text-xs text-ink-700">
                {c.rolesInvited > 0 ? `${c.rolesCompleted}/${c.rolesInvited}` : '—'}
              </td>
              <td className="py-2 pr-3 text-right text-xs text-ink-700">{c.signedInUsers || '—'}</td>
              <td className="py-2 pr-3 text-right text-xs text-ink-700">{c.exports || '—'}</td>
              <td className="py-2 pr-3 text-xs text-ink-500">
                {c.userNotesLength > 0 ? `${c.userNotesLength} chars` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JourneysTable({ rows }: { rows: Journey[] }) {
  return (
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
          {rows.map(j => (
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
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Funnel</h1>
      <p className="mt-1 text-sm text-ink-500">
        Lead-generation telemetry. Companies analyzed, how far each got, return visits, exports.
      </p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-ink-200 bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-ink-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold text-ink-900">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-400">{sub}</p>}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-medium ${
        active ? 'text-white' : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
      }`}
      style={active ? { backgroundColor: 'var(--brand, #c64a1f)' } : {}}
    >
      {children}
    </button>
  );
}

function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) return <span className="text-[11px] text-ink-400">—</span>;
  const label = STAGE_LABELS[stage] ?? stage;
  const isStop = stage === 'analogy_honest_stop';
  const isProjects = stage === 'projects_viewed';
  const isExport = stage === 'context_graph_exported';
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
        isExport
          ? 'bg-emerald-100 text-emerald-800'
          : isProjects
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
