'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  EDGE_LABEL_OPTIONS,
  GRAPH_ROLE_LABELS,
  GRAPH_ROLE_OPTIONS,
  GRAPH_TYPE_HINTS,
  GRAPH_TYPE_LABELS,
  GRAPH_TYPE_ORDER,
  type GraphEdge,
  type GraphNode,
  type GraphNodeType
} from '@/lib/model/graph';
import { useAuth } from '../AuthProvider';

interface DraftRow {
  role: string;
  name: string;
  notes: string;
}

function defaultRoleFor(type: GraphNodeType): string {
  return GRAPH_ROLE_OPTIONS[type][0];
}

function makeEmptyRow(type: GraphNodeType): DraftRow {
  return { role: defaultRoleFor(type), name: '', notes: '' };
}

type Tab = GraphNodeType | 'links';

interface EdgeDraftRow {
  fromNodeId: string;
  toNodeId: string;
  label: string;
  notes: string;
}

function makeEmptyEdgeRow(): EdgeDraftRow {
  return { fromNodeId: '', toNodeId: '', label: EDGE_LABEL_OPTIONS[0], notes: '' };
}

export function BulkAddModal({
  companyId,
  open,
  onClose,
  onAdded,
  onEdgesAdded,
  existingNodes
}: {
  companyId: string;
  open: boolean;
  onClose: () => void;
  onAdded: (nodes: GraphNode[]) => void;
  onEdgesAdded?: (edges: GraphEdge[]) => void;
  existingNodes?: GraphNode[];
}) {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('person');
  const [edgeRows, setEdgeRows] = useState<EdgeDraftRow[]>([
    makeEmptyEdgeRow(),
    makeEmptyEdgeRow(),
    makeEmptyEdgeRow()
  ]);
  const [rowsByType, setRowsByType] = useState<Record<GraphNodeType, DraftRow[]>>({
    person: [makeEmptyRow('person'), makeEmptyRow('person'), makeEmptyRow('person')],
    org: [makeEmptyRow('org'), makeEmptyRow('org'), makeEmptyRow('org')],
    location: [makeEmptyRow('location'), makeEmptyRow('location')],
    event: [makeEmptyRow('event'), makeEmptyRow('event')],
    object: [makeEmptyRow('object'), makeEmptyRow('object'), makeEmptyRow('object')]
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const activeType: GraphNodeType | null =
    activeTab === 'links' ? null : (activeTab as GraphNodeType);
  const liveNodes = (existingNodes ?? []).filter(n => !n.deletedAt);
  const canShowLinks = liveNodes.length >= 2;

  const setRow = (type: GraphNodeType, i: number, patch: Partial<DraftRow>) => {
    setRowsByType(prev => ({
      ...prev,
      [type]: prev[type].map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    }));
  };
  const addRow = (type: GraphNodeType) => {
    setRowsByType(prev => ({ ...prev, [type]: [...prev[type], makeEmptyRow(type)] }));
  };
  const removeRow = (type: GraphNodeType, i: number) => {
    setRowsByType(prev => ({
      ...prev,
      [type]: prev[type].length > 1 ? prev[type].filter((_, idx) => idx !== i) : prev[type]
    }));
  };

  const setEdgeRow = (i: number, patch: Partial<EdgeDraftRow>) => {
    setEdgeRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const addEdgeRow = () => setEdgeRows(prev => [...prev, makeEmptyEdgeRow()]);
  const removeEdgeRow = (i: number) => {
    setEdgeRows(prev => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  };

  // Collect all non-empty rows across all types.
  const allNodesToCreate = GRAPH_TYPE_ORDER.flatMap(type =>
    rowsByType[type]
      .filter(r => r.name.trim().length > 0)
      .map(r => ({
        type,
        role: r.role,
        name: r.name.trim(),
        notes: r.notes.trim() || undefined
      }))
  );
  const totalToCreate = allNodesToCreate.length;
  const edgesToCreate = edgeRows
    .filter(r => r.fromNodeId && r.toNodeId && r.fromNodeId !== r.toNodeId && r.label.trim())
    .map(r => ({
      fromNodeId: r.fromNodeId,
      toNodeId: r.toNodeId,
      label: r.label.trim(),
      notes: r.notes.trim() || undefined
    }));

  const totalActions = totalToCreate + edgesToCreate.length;

  const submit = async () => {
    if (totalActions === 0) {
      setError('Add at least one row before saving.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      // POST nodes first (so any same-batch edges reference existing IDs;
      // here edges only link EXISTING nodes anyway, so order doesn't matter
      // beyond getting both calls to land).
      if (totalToCreate > 0) {
        const res = await fetch(`/api/companies/${companyId}/graph`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ nodes: allNodesToCreate })
        });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { nodes: GraphNode[] };
        onAdded(data.nodes);
      }
      if (edgesToCreate.length > 0) {
        const res = await fetch(`/api/companies/${companyId}/graph/edges`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ edges: edgesToCreate })
        });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { edges: GraphEdge[] };
        if (onEdgesAdded) onEdgesAdded(data.edges);
      }
      onClose();
      // Reset rows for next open
      setRowsByType({
        person: [makeEmptyRow('person')],
        org: [makeEmptyRow('org')],
        location: [makeEmptyRow('location')],
        event: [makeEmptyRow('event')],
        object: [makeEmptyRow('object')]
      });
      setEdgeRows([makeEmptyEdgeRow(), makeEmptyEdgeRow(), makeEmptyEdgeRow()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const activeRows = activeType ? rowsByType[activeType] : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-6">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-ink-200 bg-white shadow-xl">
        <div className="flex items-baseline justify-between gap-4 border-b border-ink-200 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Add to your context graph</h2>
            <p className="text-[11px] text-ink-500">
              Pick a category, fill in as many rows as you want. Move between
              categories — everything saves together at the end.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-ink-100 bg-ink-50/40 px-5 py-2">
          {GRAPH_TYPE_ORDER.map(t => {
            const count = rowsByType[t].filter(r => r.name.trim()).length;
            const isActive = t === activeTab;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  isActive
                    ? 'text-white'
                    : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
                }`}
                style={isActive ? { backgroundColor: 'var(--brand, #c64a1f)' } : {}}
              >
                {GRAPH_TYPE_LABELS[t]}
                {count > 0 && (
                  <span className="ml-1.5 text-[10px] opacity-80">{count}</span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setActiveTab('links')}
            disabled={!canShowLinks}
            className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
              activeTab === 'links'
                ? 'text-white'
                : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
            }`}
            style={activeTab === 'links' ? { backgroundColor: 'var(--brand, #c64a1f)' } : {}}
            title={canShowLinks ? '' : 'Add at least 2 nodes first to link them'}
          >
            Links
            {edgesToCreate.length > 0 && (
              <span className="ml-1.5 text-[10px] opacity-80">{edgesToCreate.length}</span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activeTab === 'links' ? (
            <>
              <p className="text-[11px] text-ink-500">
                <span className="font-semibold text-ink-700">Links</span> — connect any two
                existing nodes. SKU → customer, customer → location, etc. Lines show up in the graph view.
              </p>

              <div className="mt-3 space-y-2">
                {edgeRows.map((row, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_140px_1fr_28px] gap-2 items-start"
                  >
                    <NodePicker
                      value={row.fromNodeId}
                      onChange={v => setEdgeRow(i, { fromNodeId: v })}
                      nodes={liveNodes}
                      placeholder="From…"
                    />
                    <select
                      value={row.label}
                      onChange={e => setEdgeRow(i, { label: e.target.value })}
                      className="rounded border border-ink-200 bg-white px-2 py-1.5 text-sm"
                    >
                      {EDGE_LABEL_OPTIONS.map(l => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <NodePicker
                      value={row.toNodeId}
                      onChange={v => setEdgeRow(i, { toNodeId: v })}
                      nodes={liveNodes}
                      placeholder="To…"
                    />
                    <button
                      type="button"
                      onClick={() => removeEdgeRow(i)}
                      className="flex h-8 w-7 items-center justify-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                      title="Remove row"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addEdgeRow}
                className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-ink-600 hover:text-ink-900"
              >
                <Plus className="h-3.5 w-3.5" />
                another link
              </button>
            </>
          ) : (
            <>
          <p className="text-[11px] text-ink-500">
            <span className="font-semibold text-ink-700">{GRAPH_TYPE_LABELS[activeType!]}</span>{' '}
            — {GRAPH_TYPE_HINTS[activeType!]}
          </p>

          <div className="mt-3 space-y-2">
            {activeRows.map((row, i) => (
              <div key={i} className="grid grid-cols-[140px_1fr_1fr_28px] gap-2 items-start">
                <select
                  value={row.role}
                  onChange={e => setRow(activeType!, i, { role: e.target.value })}
                  className="rounded border border-ink-200 bg-white px-2 py-1.5 text-sm"
                >
                  {GRAPH_ROLE_OPTIONS[activeType!].map(r => (
                    <option key={r} value={r}>
                      {GRAPH_ROLE_LABELS[r] ?? r}
                    </option>
                  ))}
                </select>
                <input
                  value={row.name}
                  onChange={e => setRow(activeType!, i, { name: e.target.value })}
                  placeholder="Name"
                  className="rounded border border-ink-200 bg-white px-3 py-1.5 text-sm"
                />
                <input
                  value={row.notes}
                  onChange={e => setRow(activeType!, i, { notes: e.target.value })}
                  placeholder="Notes (optional)"
                  className="rounded border border-ink-200 bg-white px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeRow(activeType!, i)}
                  className="flex h-8 w-7 items-center justify-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                  title="Remove row"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => addRow(activeType!)}
            className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-ink-600 hover:text-ink-900"
          >
            <Plus className="h-3.5 w-3.5" />
            another row
          </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-ink-200 px-5 py-3">
          <p className="text-[11px] text-ink-500">
            {totalToCreate === 0
              ? 'Add some rows above — empty rows are skipped.'
              : `${totalToCreate} ${totalToCreate === 1 ? 'node' : 'nodes'}${
                  edgesToCreate.length > 0
                    ? ` + ${edgesToCreate.length} ${edgesToCreate.length === 1 ? 'link' : 'links'}`
                    : ''
                } ready to save.`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-xs text-ink-500 hover:text-ink-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || totalActions === 0}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:bg-ink-300"
              style={{ backgroundColor: submitting || totalActions === 0 ? undefined : 'var(--brand, #c64a1f)' }}
            >
              {submitting ? 'Saving…' : totalActions === 0 ? 'Save' : `Save ${totalActions} ${totalActions === 1 ? 'item' : 'items'}`}
            </button>
          </div>
        </div>
        {error && (
          <p className="border-t border-rose-200 bg-rose-50 px-5 py-2 text-xs text-rose-900">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function NodePicker({
  value,
  onChange,
  nodes,
  placeholder
}: {
  value: string;
  onChange: (id: string) => void;
  nodes: GraphNode[];
  placeholder: string;
}) {
  // Group options by type so the dropdown is browsable.
  const groups = GRAPH_TYPE_ORDER.map(type => ({
    type,
    label: GRAPH_TYPE_LABELS[type],
    items: nodes.filter(n => n.type === type)
  })).filter(g => g.items.length > 0);

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="rounded border border-ink-200 bg-white px-2 py-1.5 text-sm"
    >
      <option value="">{placeholder}</option>
      {groups.map(g => (
        <optgroup key={g.type} label={g.label}>
          {g.items.map(n => (
            <option key={n.id} value={n.id}>
              {n.name}
              {GRAPH_ROLE_LABELS[n.role] ? ` · ${GRAPH_ROLE_LABELS[n.role]}` : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
