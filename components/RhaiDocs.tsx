'use client';

// Docs tab — one place to file the paperwork of a deal (NDAs sent, signed
// NDAs received, proposals) against a lead, and to read the funnel velocity
// it implies: first call → NDA sent → NDA signed → proposal → invoice, with
// day-deltas between milestones and amber highlights on stalled deals.
// Claude reads the date on each uploaded document (an NDA's effective date)
// so the timeline reflects when things actually happened, not when they were
// filed. Nothing is stored for the timeline itself — it's derived fresh from
// documents + notes + history + invoices on every load.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useAuthedFetch } from './useAuthedFetch';
import { STAGE_LABELS } from '@/lib/leads/types';
import {
  DOC_KIND_LABELS,
  MILESTONE_LABELS,
  MILESTONE_ORDER,
  MILESTONE_SHORT,
  STALL_DAYS,
  TRACKED_DOC_KINDS,
  formatDay,
  milestoneDeltas,
  stallInfo,
  velocitySummary,
  type DealRow,
  type TrackedDoc,
  type TrackedDocKind
} from '@/lib/rhai/docTracking';

// A lead option for the review-table dropdowns (from /parse).
interface LeadOption {
  id: string;
  label: string;
}

// One parsed file returned by /api/rhai/docs/parse.
interface ParsedFile {
  stagingId: string;
  name: string;
  size: number;
  mime: string;
  docDate: string | null;
  clientName: string | null;
  parties: string[];
  suggestedLeadId: string | null;
  suggestedLeadLabel: string | null;
  confidence: 'high' | 'low' | null;
  usedModel: boolean;
}

// An editable review row — a ParsedFile plus the operator's choices.
interface ReviewRow extends ParsedFile {
  kind: TrackedDocKind;
  date: string; // 'YYYY-MM-DD' or ''
  leadId: string; // '' = not yet chosen (skipped on save)
  error?: string;
}

export default function RhaiDocs() {
  const { user, getToken } = useAuth();
  const api = useAuthedFetch();

  const [rows, setRows] = useState<DealRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // The timeline. Lead options for the upload dropdowns come from /parse, so
  // this panel no longer needs to fetch the full lead list itself.
  const load = useCallback(async () => {
    const docsRes = await api('/api/rhai/docs');
    if (docsRes.ok) setRows(((await docsRes.json()) as { rows: DealRow[] }).rows);
    else setErr(await docsRes.text());
  }, [api]);

  useEffect(() => {
    if (!user) return;
    load().catch(() => setErr('Could not load document tracking'));
  }, [user, load]);

  return (
    <div>
      <BatchUploadCard
        getToken={getToken}
        api={api}
        onCommitted={() => load().catch(() => undefined)}
        onError={setErr}
      />

      {err && <p className="mb-3 text-xs text-rose-600">{err}</p>}

      {rows && rows.length > 0 && <VelocityStrip rows={rows} />}

      {rows === null ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
          No leads yet — the deal timeline appears once the pipeline has leads.
        </p>
      ) : (
        <TimelineTable rows={rows} api={api} onChanged={() => load().catch(() => undefined)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Batch upload — drop many files, Rhai reads each (filename fast-path, one
// cheap model call at most), then a per-row review table before anything is
// filed. Nothing hits a lead until "Confirm & save".
// ---------------------------------------------------------------------------

const ACCEPT =
  'application/pdf,image/*,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Pre-select the doc kind from the filename (mirrors the /parse default). */
function defaultKind(name: string): TrackedDocKind {
  const low = name.toLowerCase();
  if (low.includes('signed')) return 'nda-signed';
  if (low.startsWith('nda_') || /(^|[^a-z])nda([^a-z]|$)/.test(low)) return 'nda';
  if (low.includes('proposal')) return 'proposal';
  return 'other';
}

function BatchUploadCard({
  getToken,
  api,
  onCommitted,
  onError
}: {
  getToken: () => Promise<string | null>;
  api: (path: string, init?: RequestInit) => Promise<Response>;
  onCommitted: () => void;
  onError: (e: string | null) => void;
}) {
  const [reading, setReading] = useState(0); // # of files currently being read
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [batch, setBatch] = useState<ReviewRow[]>([]);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const parseFiles = async (files: File[]) => {
    if (files.length === 0) return;
    onError(null);
    setSavedNote(null);
    setReading(files.length);
    try {
      const token = await getToken();
      const fd = new FormData();
      for (const f of files.slice(0, 15)) fd.append('files', f);
      const res = await fetch('/api/rhai/docs/parse', {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: fd
      });
      if (!res.ok) throw new Error(await res.text());
      const { files: parsed, leads: opts } = (await res.json()) as {
        files: ParsedFile[];
        leads: LeadOption[];
      };
      setLeadOptions(opts);
      setBatch(prev => [
        ...prev,
        ...parsed.map<ReviewRow>(p => ({
          ...p,
          kind: defaultKind(p.name),
          date: p.docDate ?? '',
          leadId: p.confidence === 'high' ? p.suggestedLeadId ?? '' : ''
        }))
      ]);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not read the documents');
    } finally {
      setReading(0);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const patchRow = (stagingId: string, patch: Partial<ReviewRow>) =>
    setBatch(prev => prev.map(r => (r.stagingId === stagingId ? { ...r, ...patch } : r)));

  const removeRow = (stagingId: string) =>
    setBatch(prev => prev.filter(r => r.stagingId !== stagingId));

  const ready = batch.filter(r => r.leadId);
  const skipped = batch.length - ready.length;

  const save = async () => {
    if (ready.length === 0) {
      onError('Pick a lead for at least one document first.');
      return;
    }
    setSaving(true);
    onError(null);
    setSavedNote(null);
    try {
      const res = await api('/api/rhai/docs/commit', {
        method: 'POST',
        body: JSON.stringify({
          items: ready.map(r => ({
            stagingId: r.stagingId,
            name: r.name,
            mime: r.mime,
            size: r.size,
            leadId: r.leadId,
            kind: r.kind,
            docDate: r.date || null
          }))
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const { results } = (await res.json()) as {
        results: { stagingId: string | null; ok: boolean; docId?: string; error?: string }[];
      };
      const byId = new Map(results.map(r => [r.stagingId, r]));
      const failed = batch.filter(r => byId.get(r.stagingId)?.ok === false);
      const okCount = results.filter(r => r.ok).length;

      // Drop the rows that filed cleanly; keep failures (annotated) and any
      // skipped no-lead rows so she can still act on them.
      setBatch(prev =>
        prev
          .filter(r => !r.leadId || byId.get(r.stagingId)?.ok === false)
          .map(r => (byId.get(r.stagingId)?.ok === false ? { ...r, error: byId.get(r.stagingId)?.error } : r))
      );
      setSavedNote(
        failed.length === 0
          ? `Filed ${okCount} document${okCount === 1 ? '' : 's'}${
              skipped ? ` — ${skipped} skipped (no lead chosen, still listed below)` : ''
            }.`
          : `Filed ${okCount}; ${failed.length} failed — see the flagged rows below.`
      );
      onCommitted();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const field =
    'w-full rounded-md border border-ink-200 px-2 py-1.5 text-sm focus:border-ink-400 focus:outline-none';

  return (
    <div className="mb-5 rounded-lg border border-ink-200 bg-white p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        File documents
      </p>

      <div
        onDragOver={e => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          const fs = Array.from(e.dataTransfer.files ?? []);
          if (fs.length) parseFiles(fs);
        }}
        onClick={() => !reading && fileInput.current?.click()}
        className={`cursor-pointer rounded-md border border-dashed px-4 py-6 text-center text-sm transition-colors ${
          dragging ? 'border-accent bg-accent-soft/40 text-ink-700' : 'border-ink-200 text-ink-400 hover:bg-ink-50'
        }`}
      >
        {reading > 0
          ? `Reading ${reading} document${reading === 1 ? '' : 's'}…`
          : 'Drop PDFs, images or docx here (up to 15), or click to choose. Rhai reads the date and client off each — you confirm before anything is filed.'}
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={e => {
            const fs = Array.from(e.target.files ?? []);
            if (fs.length) parseFiles(fs);
          }}
        />
      </div>

      {savedNote && (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {savedNote}
        </p>
      )}

      {batch.length > 0 && (
        <div className="mt-4">
          <div className="overflow-x-auto rounded-md border border-ink-200">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                  <th className="px-3 py-2">Document</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Lead</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {batch.map(row => (
                  <ReviewTableRow
                    key={row.stagingId}
                    row={row}
                    leadOptions={leadOptions}
                    field={field}
                    onPatch={patchRow}
                    onRemove={removeRow}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || ready.length === 0}
              className="rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? 'Saving…' : `Confirm & save ${ready.length}`}
            </button>
            {skipped > 0 && (
              <span className="text-xs text-amber-700">
                {skipped} row{skipped === 1 ? '' : 's'} will be skipped (no lead chosen)
              </span>
            )}
            <button
              type="button"
              onClick={() => setBatch([])}
              disabled={saving}
              className="ml-auto text-xs text-ink-400 hover:text-ink-600"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewTableRow({
  row,
  leadOptions,
  field,
  onPatch,
  onRemove
}: {
  row: ReviewRow;
  leadOptions: LeadOption[];
  field: string;
  onPatch: (stagingId: string, patch: Partial<ReviewRow>) => void;
  onRemove: (stagingId: string) => void;
}) {
  const highMatch = row.confidence === 'high' && !!row.leadId;
  return (
    <tr className={`border-b border-ink-100 last:border-b-0 ${row.error ? 'bg-rose-50' : ''}`}>
      <td className="px-3 py-2 align-top">
        <p className="max-w-[220px] truncate font-medium text-ink-800" title={row.name}>
          {row.name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {highMatch ? (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800">
              ✓ auto-matched
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
              confirm client
            </span>
          )}
          {row.usedModel && <span className="text-[9px] text-ink-400">read by Rhai</span>}
          {row.clientName && <span className="text-[9px] text-ink-400">· {row.clientName}</span>}
        </div>
        {row.error && <p className="mt-0.5 text-[10px] text-rose-600">{row.error}</p>}
      </td>
      <td className="px-3 py-2 align-top">
        <select
          value={row.kind}
          onChange={e => onPatch(row.stagingId, { kind: e.target.value as TrackedDocKind })}
          className={field}
        >
          {TRACKED_DOC_KINDS.map(k => (
            <option key={k} value={k}>
              {DOC_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 align-top">
        <input
          type="date"
          value={row.date}
          onChange={e => onPatch(row.stagingId, { date: e.target.value })}
          className={field}
          title="Blank = the upload time will stand in on the timeline."
        />
      </td>
      <td className="px-3 py-2 align-top">
        <select
          value={row.leadId}
          onChange={e => onPatch(row.stagingId, { leadId: e.target.value })}
          className={`${field} ${row.leadId ? '' : 'text-ink-400'}`}
        >
          <option value="">— pick a lead —</option>
          {leadOptions.map(o => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 align-top text-right">
        <button
          type="button"
          onClick={() => onRemove(row.stagingId)}
          className="text-xs text-ink-300 hover:text-rose-500"
          title="Drop this document from the batch"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Velocity summary — medians across leads that have both endpoints.
// ---------------------------------------------------------------------------

function VelocityStrip({ rows }: { rows: DealRow[] }) {
  const v = useMemo(() => velocitySummary(rows), [rows]);
  const fmt = (days: number | null) => (days === null ? '—' : `${days}d`);
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <VelocityStat label="Call → NDA" value={fmt(v.callToNda)} n={v.counts.callToNda} />
      <VelocityStat label="NDA → Proposal" value={fmt(v.ndaToProposal)} n={v.counts.ndaToProposal} />
      <VelocityStat label="Proposal → Invoice" value={fmt(v.proposalToInvoice)} n={v.counts.proposalToInvoice} />
    </div>
  );
}

function VelocityStat({ label, value, n }: { label: string; value: string; n: number }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Median {label}</p>
      <p className="mt-1 font-display text-2xl tracking-tight text-ink-900">{value}</p>
      <p className="text-[10px] text-ink-400">{n === 0 ? 'no deals with both dates yet' : `across ${n} deal${n === 1 ? '' : 's'}`}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deal timeline table
// ---------------------------------------------------------------------------

function TimelineTable({
  rows,
  api,
  onChanged
}: {
  rows: DealRow[];
  api: (p: string, i?: RequestInit) => Promise<Response>;
  onChanged: () => void;
}) {
  const now = Date.now();
  const colCount = 2 + MILESTONE_ORDER.length;
  return (
    <div className="overflow-x-auto rounded-lg border border-ink-200 bg-white">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            <th className="px-4 py-2.5">Lead</th>
            <th className="px-3 py-2.5">Stage</th>
            {MILESTONE_ORDER.map(k => (
              <th key={k} className="px-3 py-2.5">
                {MILESTONE_LABELS[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <TimelineRow key={row.leadId} row={row} nowMs={now} api={api} onChanged={onChanged} colCount={colCount} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelineRow({
  row,
  nowMs,
  api,
  onChanged,
  colCount
}: {
  row: DealRow;
  nowMs: number;
  api: (p: string, i?: RequestInit) => Promise<Response>;
  onChanged: () => void;
  colCount: number;
}) {
  const stall = stallInfo(row, nowMs);
  const deltas = milestoneDeltas(row.milestones);
  const deltaInto = new Map(deltas.map(d => [d.to, d]));
  const [editing, setEditing] = useState(false);

  return (
    <>
    <tr className={`border-b border-ink-100 last:border-b-0 ${stall ? 'bg-amber-50' : ''}`}>
      <td className="px-4 py-3 align-top">
        <p className="font-medium text-ink-900">{row.person || row.company || '(unnamed lead)'}</p>
        {row.person && row.company && <p className="text-[11px] text-ink-400">{row.company}</p>}
        {row.documents.length > 0 && (
          <button
            type="button"
            onClick={() => setEditing(e => !e)}
            className="mt-0.5 text-[10px] font-medium text-accent hover:underline"
          >
            {editing ? 'hide' : 'edit'} {row.documents.length} doc{row.documents.length === 1 ? '' : 's'}
          </button>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-600">
          {STAGE_LABELS[row.stage] ?? row.stage}
        </span>
      </td>
      {MILESTONE_ORDER.map(k => {
        const at = row.milestones[k];
        const delta = deltaInto.get(k);
        const isStallNext = stall?.next === k;
        if (typeof at === 'number') {
          return (
            <td key={k} className="px-3 py-3 align-top">
              <p className="whitespace-nowrap text-ink-800">{formatDay(at)}</p>
              {delta && (
                <p className="whitespace-nowrap text-[10px] text-ink-400">
                  {MILESTONE_SHORT[delta.from]} → {MILESTONE_SHORT[delta.to]}: {delta.days}d
                </p>
              )}
            </td>
          );
        }
        if (k === 'invoiceSent' && row.invoiceSentNoDate) {
          return (
            <td key={k} className="px-3 py-3 align-top">
              <p className="text-ink-500">✓ sent</p>
              <p className="text-[10px] text-ink-400">no date on file</p>
            </td>
          );
        }
        return (
          <td key={k} className="px-3 py-3 align-top">
            {isStallNext ? (
              <span
                className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900"
                title={`Next milestone missing for ${stall!.daysSince} days (stall threshold ${STALL_DAYS}d). Last movement ${formatDay(
                  lastMilestoneAt(row) ?? nowMs
                )}.`}
              >
                stalled {stall!.daysSince}d
              </span>
            ) : (
              <span className="text-ink-300">—</span>
            )}
          </td>
        );
      })}
    </tr>
    {editing && (
      <tr className="border-b border-ink-100 bg-cream-50/60">
        <td colSpan={colCount} className="px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Documents on file — fix the date or type if it got read wrong
          </p>
          <div className="space-y-1.5">
            {row.documents.map(doc => (
              <DocEditRow key={doc.id} leadId={row.leadId} doc={doc} api={api} onChanged={onChanged} />
            ))}
          </div>
        </td>
      </tr>
    )}
    </>
  );
}

function toDateInput(doc: TrackedDoc): string {
  const ms = doc.docDate ?? doc.at;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function DocEditRow({
  leadId,
  doc,
  api,
  onChanged
}: {
  leadId: string;
  doc: TrackedDoc;
  api: (p: string, i?: RequestInit) => Promise<Response>;
  onChanged: () => void;
}) {
  const [date, setDate] = useState(toDateInput(doc));
  const [kind, setKind] = useState(doc.kind as TrackedDocKind);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = date !== toDateInput(doc) || kind !== doc.kind;

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await api('/api/rhai/docs', {
        method: 'PATCH',
        body: JSON.stringify({ leadId, docId: doc.id, docDate: date || null, kind })
      });
      if (res.ok) {
        setSaved(true);
        onChanged();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="min-w-0 flex-1 truncate text-ink-600" title={doc.name}>
        {doc.name}
        {doc.docDate == null && <span className="ml-1 text-[10px] text-amber-600">(date inferred)</span>}
      </span>
      <select
        value={kind}
        onChange={e => setKind(e.target.value as TrackedDocKind)}
        className="rounded border border-ink-200 bg-white px-1.5 py-1 text-[11px]"
      >
        {TRACKED_DOC_KINDS.map(k => (
          <option key={k} value={k}>
            {DOC_KIND_LABELS[k]}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        className="rounded border border-ink-200 bg-white px-1.5 py-1 text-[11px]"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty}
        className="rounded bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:bg-accent-600 disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      {saved && !dirty && <span className="text-[11px] text-emerald-600">✓</span>}
    </div>
  );
}

function lastMilestoneAt(row: DealRow): number | null {
  const vals = Object.values(row.milestones).filter((v): v is number => typeof v === 'number');
  return vals.length ? Math.max(...vals) : null;
}
