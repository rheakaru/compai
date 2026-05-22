'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Trash2 } from 'lucide-react';
import {
  GRAPH_TYPE_HINTS,
  GRAPH_TYPE_LABELS,
  GRAPH_TYPE_ORDER,
  type GraphEdge,
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
  initialEdges = [],
  canEdit
}: {
  companyId: string;
  initialNodes: GraphNode[];
  initialEdges?: GraphEdge[];
  canEdit: boolean;
}) {
  const { user, getToken } = useAuth();
  const [nodes, setNodes] = useState<GraphNode[]>(initialNodes);
  const [edges, setEdges] = useState<GraphEdge[]>(initialEdges);
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
        const data = (await res.json()) as { nodes: GraphNode[]; edges?: GraphEdge[] };
        if (cancelled) return;
        setNodes(data.nodes);
        if (Array.isArray(data.edges)) setEdges(data.edges);
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
        const data = (await res.json()) as { nodes?: GraphNode[]; edges?: GraphEdge[] };
        if (Array.isArray(data.nodes) && data.nodes.length > 0) {
          setNodes(data.nodes);
        }
        if (Array.isArray(data.edges)) setEdges(data.edges);
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
  const onEdgesAdded = (added: GraphEdge[]) => {
    setEdges(prev => [...prev, ...added]);
  };
  const onEdgeDeleted = async (edgeId: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/companies/${companyId}/graph/edges/${edgeId}`, {
        method: 'DELETE',
        headers: token ? { authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) return;
      setEdges(prev => prev.filter(e => e.id !== edgeId));
    } catch {
      // ignore
    }
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
            <p className="text-base font-semibold text-ink-900">The shape, in nouns</p>
            <p className="mt-0.5 text-xs text-ink-500">
              The people, orgs, places, events, and things that make up your world. We pulled what we could; add the rest.
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

        {view === 'graph' && totalNodes > 0 && edges.filter(e => !e.deletedAt).length >= 3 && (
          <div className="mt-5">
            <ContextGraphView nodes={nodes} edges={edges} />
            <p className="mt-2 text-[11px] text-ink-400">
              How the pieces of your business connect. Hover any line for the label.
            </p>
          </div>
        )}

        {view === 'graph' && totalNodes > 0 && edges.filter(e => !e.deletedAt).length < 3 && (
          <div className="mt-5 rounded-md border border-dashed border-ink-200 bg-ink-50/40 px-4 py-3 text-sm">
            <p className="font-medium text-ink-800">Map how the pieces of your business connect →</p>
            <p className="mt-1 text-xs text-ink-500">
              Switch to list to see what we extracted; add a few relationships (SKU →
              customer, customer → location) and the graph view fills in.
            </p>
            <button
              type="button"
              onClick={() => setView('list')}
              className="mt-2 text-[12px] font-medium underline-offset-2 hover:underline"
              style={{ color: 'var(--brand, #c64a1f)' }}
            >
              See what&apos;s in your context
            </button>
          </div>
        )}

        {view === 'list' && (
        <>
        {/* Links subsection — relationships between the nodes above. */}
        {(edges.length > 0 || canEdit) && (
          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-700">
                Links · {edges.length}
              </p>
              <p className="text-[10px] text-ink-400">
                Connect SKUs to customers, customers to locations, etc.
              </p>
            </div>
            {edges.length === 0 ? (
              <p className="mt-2 text-xs italic text-ink-400">
                {canEdit
                  ? 'No relationships yet — click "Add nodes" → "Links" tab to add some.'
                  : 'No relationships yet.'}
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {edges.map(edge => {
                  const fromNode = nodes.find(n => n.id === edge.fromNodeId);
                  const toNode = nodes.find(n => n.id === edge.toNodeId);
                  if (!fromNode || !toNode) return null;
                  return (
                    <li
                      key={edge.id}
                      className="group flex items-center gap-2 rounded border border-ink-100 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <span className="truncate font-medium text-ink-900">{fromNode.name}</span>
                      <span
                        className="flex-none rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white"
                        style={{ backgroundColor: 'var(--brand, #c64a1f)' }}
                      >
                        {edge.label}
                      </span>
                      <span className="truncate font-medium text-ink-900">{toNode.name}</span>
                      {edge.notes && (
                        <span className="truncate text-[11px] text-ink-500">· {edge.notes}</span>
                      )}
                      <div className="ml-auto flex flex-none items-center gap-1">
                        <span
                          className={`badge ${
                            edge.source === 'agent' ? 'badge-hypothesis' : 'badge-user'
                          }`}
                        >
                          {edge.source === 'agent' ? 'agent' : 'you'}
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => onEdgeDeleted(edge.id)}
                            className="rounded p-1 text-ink-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-700 group-hover:opacity-100"
                            title="Delete link"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

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
        </>
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
        existingNodes={nodes}
        onEdgesAdded={onEdgesAdded}
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
