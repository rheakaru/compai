'use client';

import { useState } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { GRAPH_ROLE_LABELS, GRAPH_ROLE_OPTIONS, type GraphNode } from '@/lib/model/graph';
import { ProvenanceBadge } from '../ProvenanceBadge';
import { useAuth } from '../AuthProvider';

export function GraphNodeChip({
  node,
  companyId,
  canEdit,
  onUpdated,
  onDeleted
}: {
  node: GraphNode;
  companyId: string;
  canEdit: boolean;
  onUpdated: (n: GraphNode) => void;
  onDeleted: (id: string) => void;
}) {
  const { getToken } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(node.name);
  const [role, setRole] = useState(node.role);
  const [notes, setNotes] = useState(node.notes ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/companies/${companyId}/graph/${node.id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ name: name.trim(), role, notes: notes.trim() || null })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { node: GraphNode };
      onUpdated(data.node);
      setEditing(false);
    } catch {
      // swallow — TODO: surface error
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/companies/${companyId}/graph/${node.id}`, {
        method: 'DELETE',
        headers: token ? { authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onDeleted(node.id);
    } catch {
      setBusy(false);
    }
  };

  const roleLabel = GRAPH_ROLE_LABELS[node.role] ?? node.role;

  if (editing) {
    return (
      <div className="rounded-md border border-ink-300 bg-white p-2.5">
        <div className="flex gap-2">
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="rounded border border-ink-200 bg-white px-1.5 py-1 text-xs"
          >
            {GRAPH_ROLE_OPTIONS[node.type].map(r => (
              <option key={r} value={r}>
                {GRAPH_ROLE_LABELS[r] ?? r}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Name"
            className="flex-1 rounded border border-ink-200 bg-white px-2 py-1 text-sm"
            autoFocus
          />
        </div>
        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="mt-1.5 w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs"
        />
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setName(node.name);
              setRole(node.role);
              setNotes(node.notes ?? '');
            }}
            className="rounded px-2 py-0.5 text-[11px] text-ink-500 hover:text-ink-800"
            disabled={busy}
          >
            cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !name.trim()}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-white disabled:bg-ink-300"
            style={{ backgroundColor: 'var(--brand, #c64a1f)' }}
          >
            <Check className="h-3 w-3" /> save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2 rounded-md border border-ink-100 bg-white px-2.5 py-1.5 hover:border-ink-200">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-sm font-medium text-ink-900">{node.name}</span>
          <span className="text-[10px] uppercase tracking-wide text-ink-400">· {roleLabel}</span>
        </div>
        {node.notes && (
          <p className="mt-0.5 truncate text-xs text-ink-500">{node.notes}</p>
        )}
      </div>
      <div className="flex flex-none items-center gap-1">
        <ProvenanceBadge provenance={node.provenance} />
        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded p-1 text-ink-400 opacity-0 transition-opacity hover:bg-ink-100 hover:text-ink-700 group-hover:opacity-100"
              title="Edit"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded p-1 text-ink-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-700 group-hover:opacity-100"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
