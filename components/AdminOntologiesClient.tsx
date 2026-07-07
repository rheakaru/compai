'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';

interface WorkspaceSummary {
  workspaceId: string;
  name: string | null;
  slug: string | null;
  createdAt: number | null;
  lastActive: number | null;
  builderEmail: string | null;
  builderName: string | null;
  members: string[];
  personas: number;
  channels: number;
  buckets: number;
  entityCollections: number;
  styleTemplates: number;
  calendarSlots: number;
  creatives: number;
  hasIntake: boolean;
}

export function AdminOntologiesClient() {
  const { user, getToken, signIn } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<WorkspaceSummary | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [mdLoading, setMdLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const res = await fetch('/api/admin/ontologies', {
          headers: token ? { authorization: `Bearer ${token}` } : {}
        });
        if (res.status === 403) {
          setError("You're signed in, but this account is not the operator. Ask Rhea to grant operator:true.");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = (await res.json()) as { workspaces: WorkspaceSummary[] };
        setWorkspaces(d.workspaces);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [user, getToken]);

  async function openWorkspace(ws: WorkspaceSummary) {
    setSelected(ws);
    setMarkdown(null);
    setCopied(false);
    setMdLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/ontologies?workspaceId=${encodeURIComponent(ws.workspaceId)}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as { markdown: string };
      setMarkdown(d.markdown);
    } catch (err) {
      setMarkdown(`_Failed to load: ${err instanceof Error ? err.message : String(err)}_`);
    } finally {
      setMdLoading(false);
    }
  }

  function downloadMd() {
    if (!markdown || !selected) return;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${selected.slug || selected.workspaceId}-ontology.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copyMd() {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!user) {
    return (
      <Wrapper>
        <p className="text-ink-700">Sign in with the operator account to view ontologies.</p>
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
        <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>
      </Wrapper>
    );
  }

  if (!workspaces || workspaces.length === 0) {
    return <Wrapper><p className="text-ink-500">No marketing workspaces yet.</p></Wrapper>;
  }

  return (
    <Wrapper>
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,380px)_1fr]">
        <div className="space-y-2">
          {workspaces.map(ws => (
            <button
              key={ws.workspaceId}
              type="button"
              onClick={() => openWorkspace(ws)}
              className={`block w-full rounded-md border px-4 py-3 text-left transition ${
                selected?.workspaceId === ws.workspaceId
                  ? 'border-ink-400 bg-ink-50'
                  : 'border-ink-200 bg-white hover:bg-ink-50'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-medium text-ink-900">{ws.name || ws.slug || ws.workspaceId}</p>
                {ws.createdAt && (
                  <p className="shrink-0 text-[11px] text-ink-400">
                    {new Date(ws.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </p>
                )}
              </div>
              {(ws.builderName || ws.builderEmail) && (
                <p className="mt-0.5 truncate text-[11px] text-ink-600">
                  {ws.builderName ? `${ws.builderName} · ` : ''}
                  <span className="text-indigo-600">{ws.builderEmail}</span>
                </p>
              )}
              <p className="mt-1 text-[11px] text-ink-500">
                {ws.personas} personas · {ws.channels} channels · {ws.buckets} buckets ·{' '}
                {ws.entityCollections} collections · {ws.calendarSlots} calendar slots
                {!ws.hasIntake && <span className="ml-1 text-amber-700">· no intake</span>}
              </p>
            </button>
          ))}
        </div>

        <div>
          {!selected ? (
            <p className="pt-2 text-sm text-ink-400">Select a company to view its ontology.</p>
          ) : (
            <div className="rounded-md border border-ink-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-ink-200 px-4 py-2.5">
                <p className="truncate text-sm font-medium text-ink-900">
                  {selected.name || selected.slug || selected.workspaceId}
                  <span className="ml-2 font-mono text-[11px] font-normal text-ink-400">{selected.workspaceId}</span>
                </p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={copyMd}
                    disabled={!markdown}
                    className="rounded-md border border-ink-200 px-2.5 py-1 text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                  >
                    {copied ? 'Copied ✓' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={downloadMd}
                    disabled={!markdown}
                    className="rounded-md border border-ink-200 px-2.5 py-1 text-xs text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                  >
                    Download .md
                  </button>
                </div>
              </div>
              {mdLoading ? (
                <p className="px-4 py-6 text-sm text-ink-500">Building ontology…</p>
              ) : (
                <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap px-4 py-4 font-mono text-xs leading-relaxed text-ink-800">
                  {markdown}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Marketing ontologies</h1>
      <p className="mt-1 text-sm text-ink-500">
        Every company that used the Marketing Engine — click one to view, copy, or download its ontology brief.
      </p>
      <div className="mt-6">{children}</div>
    </div>
  );
}
