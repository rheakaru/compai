'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import type { AxisPositionClaim } from '@/lib/model/claims';
import type { Axis, CorrectionType } from '@/lib/ontology/types';
import { ProvenanceBadge } from './ProvenanceBadge';
import { axisIcon } from '@/lib/ontology/axis-icons';
import { getAxisLabel } from '@/lib/ontology/display-labels';

export interface AxisEditPayload {
  axisId: string;
  position: string;
  confidence: number;
  userNote: string;
  type: CorrectionType;
}

export function EditableAxisCard({
  axis,
  claim,
  onEditStart,
  onSubmit,
  canEdit
}: {
  axis: Axis;
  claim: AxisPositionClaim | null;
  onEditStart: () => void;
  onSubmit: (payload: AxisEditPayload) => Promise<void>;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState<string>(claim?.content.position ?? '');
  const [note, setNote] = useState<string>('');
  const [type, setType] = useState<CorrectionType>('wrong_about_reading');
  const [submitting, setSubmitting] = useState(false);

  const Icon = axisIcon(axis.id);
  const isLoadBearing = axis.load_bearing_rank <= 5;
  const lowConfidence = claim ? claim.content.confidence < 0.6 : false;
  const showCandidates = lowConfidence && claim?.content.candidateA && claim?.content.candidateB;
  const positionOptions = enumeratePositions(axis);
  const evidenceCount = claim?.content.evidence.length ?? 0;
  const hasDeviation = !!claim?.content.deviation?.hotProblem;
  const label = getAxisLabel(axis.id, axis.name);

  const openEdit = () => {
    if (!claim) return;
    setPosition(claim.content.position);
    setNote('');
    setType('wrong_about_reading');
    setEditing(true);
    setExpanded(true);
    onEditStart();
  };

  return (
    <div
      className={`card relative ${isLoadBearing ? 'ring-1 ring-ink-300' : 'opacity-95'}`}
      data-axis={axis.id}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 flex-none items-center justify-center rounded-md"
          style={{ backgroundColor: 'rgba(86,86,77,0.07)' }}
        >
          <Icon className="h-4 w-4 text-ink-600" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {label.handle && (
                <p className="text-[10px] uppercase tracking-wider text-ink-400">
                  {label.handle}
                </p>
              )}
              <h3 className="text-[15px] font-semibold leading-tight text-ink-900">
                {label.title}
              </h3>
              {label.gloss && (
                <p className="mt-0.5 text-xs text-ink-500">{label.gloss}</p>
              )}
            </div>
            <span className="flex-none whitespace-nowrap text-[10px] uppercase tracking-wide text-ink-400">
              {isLoadBearing
                ? `Load · #${axis.load_bearing_rank}`
                : `Refining · #${axis.load_bearing_rank}`}
            </span>
          </div>

          {!claim ? (
            <p className="mt-2 text-sm text-ink-400">Reading…</p>
          ) : !editing && showCandidates ? (
            <div className="mt-3">
              <p className="text-[11px] uppercase tracking-wider text-rose-700">
                Evidence is thin — two reads
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <CandidateBlock
                  label="A"
                  position={claim.content.candidateA!.position}
                  implication={claim.content.candidateA!.implication}
                />
                <CandidateBlock
                  label="B"
                  position={claim.content.candidateB!.position}
                  implication={claim.content.candidateB!.implication}
                />
              </div>
              {claim.content.disambiguatingQuestion && (
                <p className="mt-2 text-sm font-medium text-ink-800">
                  <span className="text-ink-400">Q · </span>
                  {claim.content.disambiguatingQuestion}
                </p>
              )}
            </div>
          ) : !editing ? (
            <p className="mt-2 text-[15px] font-medium text-ink-900">
              {claim.content.position}
            </p>
          ) : null}

          {claim && !editing && hasDeviation && (
            <div
              className="mt-2 rounded border-l-2 bg-ink-50/60 px-2.5 py-1.5 text-xs text-ink-700"
              style={{ borderLeftColor: 'var(--brand, #c64a1f)' }}
            >
              <span className="font-medium text-ink-800">Deviation: </span>
              {claim.content.deviation!.hotProblem}
            </div>
          )}
        </div>
      </div>

      {editing && claim && (
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (submitting) return;
            setSubmitting(true);
            try {
              await onSubmit({
                axisId: axis.id,
                position: position.trim(),
                confidence: 0.9,
                userNote: note.trim(),
                type
              });
              setEditing(false);
            } finally {
              setSubmitting(false);
            }
          }}
          className="mt-4 space-y-3 border-t border-ink-100 pt-3"
        >
          <div>
            <label className="text-[11px] uppercase tracking-wider text-ink-500">Position</label>
            {positionOptions.length > 0 ? (
              <select
                value={position}
                onChange={e => setPosition(e.target.value)}
                className="mt-1 w-full rounded border border-ink-200 bg-white px-2 py-1.5 text-sm"
              >
                {positionOptions.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={position}
                onChange={e => setPosition(e.target.value)}
                className="mt-1 w-full rounded border border-ink-200 bg-white px-2 py-1.5 text-sm"
                placeholder="A label for this axis"
              />
            )}
          </div>
          <fieldset>
            <legend className="text-[11px] uppercase tracking-wider text-ink-500">
              Is this wrong about your company, or wrong about the reading?
            </legend>
            <div className="mt-1 space-y-1 text-sm">
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name={`type-${axis.id}`}
                  checked={type === 'wrong_about_company'}
                  onChange={() => setType('wrong_about_company')}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">Wrong about the company.</span>{' '}
                  <span className="text-ink-500">The reality is different.</span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name={`type-${axis.id}`}
                  checked={type === 'wrong_about_reading'}
                  onChange={() => setType('wrong_about_reading')}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">Wrong about the reading.</span>{' '}
                  <span className="text-ink-500">Evidence pointed somewhere but we misread.</span>
                </span>
              </label>
            </div>
          </fieldset>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-ink-500">Note</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full resize-none rounded border border-ink-200 bg-white px-2 py-1.5 text-sm"
              placeholder="One line so future-us learns from this."
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded px-2 py-1 text-xs text-ink-500 hover:text-ink-800"
            >
              cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !position.trim()}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:bg-ink-300"
              style={{ backgroundColor: submitting ? undefined : 'var(--brand, #c64a1f)' }}
            >
              {submitting ? 'Saving…' : 'Save correction'}
            </button>
          </div>
        </form>
      )}

      {claim && !editing && evidenceCount > 0 && (
        <>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-2.5">
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-ink-500 hover:text-ink-800"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" /> Hide evidence
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" /> {evidenceCount}{' '}
                  {evidenceCount === 1 ? 'piece' : 'pieces'} of evidence
                </>
              )}
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={openEdit}
                className="flex items-center gap-1 rounded border border-ink-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-500 hover:bg-ink-50 hover:text-ink-800"
              >
                <Pencil className="h-3 w-3" /> correct
              </button>
            )}
          </div>
          {expanded && (
            <div className="mt-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-ink-400">
                {label.technical_term}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {claim.content.evidence.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-ink-600">
                    <ProvenanceBadge provenance={e.provenance} />
                    <span className="leading-snug">
                      {e.quote}
                      {e.source && (
                        <span className="ml-1 text-ink-400">· {truncateSource(e.source)}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {claim && !editing && evidenceCount === 0 && canEdit && (
        <div className="mt-3 flex justify-end border-t border-ink-100 pt-2.5">
          <button
            type="button"
            onClick={openEdit}
            className="flex items-center gap-1 rounded border border-ink-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-500 hover:bg-ink-50 hover:text-ink-800"
          >
            <Pencil className="h-3 w-3" /> correct
          </button>
        </div>
      )}
    </div>
  );
}

function CandidateBlock({
  label,
  position,
  implication
}: {
  label: string;
  position: string;
  implication: string;
}) {
  return (
    <div className="rounded border border-ink-200 bg-ink-50 p-2">
      <p className="text-[10px] uppercase tracking-wide text-ink-400">
        If {label} · {position}
      </p>
      <p className="mt-1 text-xs leading-snug text-ink-700">{implication}</p>
    </div>
  );
}

function enumeratePositions(axis: Axis): string[] {
  if (axis.values && axis.values.length > 0) return axis.values;
  if (axis.cells && Object.keys(axis.cells).length > 0) return Object.keys(axis.cells);
  if (axis.consequence && Object.keys(axis.consequence).length > 0) {
    return Object.keys(axis.consequence);
  }
  return [];
}

function truncateSource(s: string): string {
  if (s.length <= 36) return s;
  try {
    const u = new URL(s);
    return u.hostname;
  } catch {
    return s.slice(0, 36) + '…';
  }
}
