'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  GRAPH_TYPE_HINTS,
  GRAPH_TYPE_LABELS,
  GRAPH_TYPE_ORDER,
  type GraphNode,
  type GraphNodeType
} from '@/lib/model/graph';
import { useAuth } from '../AuthProvider';
import { GraphNodeChip } from './GraphNodeChip';
import { BulkAddModal } from './BulkAddModal';
import { ContextGraphView } from './ContextGraphView';
import { AuthGateModal } from '../AuthGateModal';

export function ContextGraphSection({
  companyId,
  initialNodes,
  canEdit
}: {
  companyId: string;
  initialNodes: GraphNode[];
  canEdit: boolean;
}) {
  const { user, getToken } = useAuth();
  const [nodes, setNodes] = useState<GraphNode[]>(initialNodes);
  const [modalOpen, setModalOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillTried, setBackfillTried] = useState(false);
  const [view, setView] = useState<'graph' | 'list'>('graph');

  // Live-refresh on mount in case streaming wrote nodes after SSR.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`/api/companies/${companyId}/graph`, {
          headers: token ? { authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) return;
        const data = (await res.json()) as { nodes: GraphNode[] };
        if (!cancelled) setNodes(data.nodes);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, getToken]);

  // Auto-backfill: if the graph is empty AND the user is signed in AND owner,
  // trigger one server-side extraction from the existing diagnosis. Idempotent
  // server-side, so refreshing this page after the call is safe.
  useEffect(() => {
    if (!user || !canEdit || backfillTried || backfilling) return;
    if (nodes.length > 0) return;
    setBackfillTried(true);
    (async () => {
      setBackfilling(true);
      try {
        const token = await getToken();
        const res = await fetch(`/api/companies/${companyId}/graph/backfill`, {
          method: 'POST',
          headers: token ? { authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) return;
        const data = (await res.json()) as { nodes?: GraphNode[] };
        if (Array.isArray(data.nodes) && data.nodes.length > 0) {
          setNodes(data.nodes);
        }
      } catch {
        // silent — the manual "Add nodes" path still works
      } finally {
        setBackfilling(false);
      }
    })();
  }, [user, canEdit, backfillTried, backfilling, nodes.length, companyId, getToken]);

  const grouped = useMemo(() => {
    const map = new Map<GraphNodeType, GraphNode[]>();
    for (const t of GRAPH_TYPE_ORDER) map.set(t, []);
    for (const n of nodes) {
      if (n.deletedAt) continue;
      map.get(n.type)?.push(n);
    }
    return map;
  }, [nodes]);

  const onAdded = (added: GraphNode[]) => {
    setNodes(prev => [...prev, ...added]);
  };
  const onUpdated = (updated: GraphNode) => {
    setNodes(prev => prev.map(n => (n.id === updated.id ? updated : n)));
  };
  const onDeleted = (id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
  };

  const openAdd = () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setModalOpen(true);
  };

  const totalNodes = nodes.filter(n => !n.deletedAt).length;

  return (
    <>
      <div className="card">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              The shape, in nouns
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              People, orgs, places, events, and things that make up your world. We auto-added what we found publicly — add the rest, edit anything that&apos;s off.
            </p>
          </div>
          <div className="flex flex-none items-center gap-2">
            <div className="flex rounded-md border border-ink-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setView('graph')}
                className={`rounded px-2 py-1 text-[11px] font-medium ${
                  view === 'graph' ? 'text-white' : 'text-ink-600 hover:text-ink-900'
                }`}
                style={view === 'graph' ? { backgroundColor: 'var(--brand, #c64a1f)' } : {}}
              >
                graph
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={`rounded px-2 py-1 text-[11px] font-medium ${
                  view === 'list' ? 'text-white' : 'text-ink-600 hover:text-ink-900'
                }`}
                style={view === 'list' ? { backgroundColor: 'var(--brand, #c64a1f)' } : {}}
              >
                list
              </button>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={openAdd}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-white"
                style={{ backgroundColor: 'var(--brand, #c64a1f)' }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add nodes
              </button>
            )}
          </div>
        </div>

        {view === 'graph' && totalNodes > 0 && (
          <div className="mt-5">
            <ContextGraphView nodes={nodes} />
            <p className="mt-2 text-[11px] text-ink-400">
              Hub-and-spoke: every node connects to the company at the centre. Hover to inspect; switch to list to edit.
            </p>
          </div>
        )}

        {view === 'list' && (
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {GRAPH_TYPE_ORDER.map(type => {
            const items = grouped.get(type) ?? [];
            return (
              <div key={type}>
                <div className="flex items-baseline gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-700">
                    {GRAPH_TYPE_LABELS[type]}
                  </p>
                  <span className="text-[11px] text-ink-400">{items.length}</span>
                </div>
                <p className="text-[10px] text-ink-400">{GRAPH_TYPE_HINTS[type]}</p>
                {items.length === 0 ? (
                  <p className="mt-2 text-xs italic text-ink-400">
                    {canEdit ? 'Nothing here yet — add some.' : 'Nothing here yet.'}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {items.map(n => (
                      <li key={n.id}>
                        <GraphNodeChip
                          node={n}
                          companyId={companyId}
                          canEdit={canEdit && !!user}
                          onUpdated={onUpdated}
                          onDeleted={onDeleted}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        )}

        {totalNodes === 0 && (
          <p className="mt-5 rounded border border-dashed border-ink-200 bg-ink-50/40 px-3 py-2 text-xs text-ink-500">
            {backfilling
              ? 'Extracting your context graph from the diagnosis…'
              : !user && canEdit
                ? 'Sign in to auto-populate this graph from your diagnosis, or add nodes manually.'
                : canEdit
                  ? 'No nodes yet — use "Add nodes" to add some manually.'
                  : 'No context graph nodes yet.'}
          </p>
        )}
      </div>

      <BulkAddModal
        companyId={companyId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdded={onAdded}
      />
      <AuthGateModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSignedIn={() => {
          setAuthOpen(false);
          setModalOpen(true);
        }}
      />
    </>
  );
}
