'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, CornerDownRight } from 'lucide-react';
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
  const label = getAxisLabel(axis.id, axis.name);

  // The headline answer: plainSummary when present, fallback to the technical
  // position. New analyses will always have plainSummary.
  const headlineAnswer = claim?.content.plainSummary ?? claim?.content.position ?? '';

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
      className={`card relative flex flex-col ${isLoadBearing ? 'ring-1 ring-ink-300' : 'opacity-95'}`}
      data-axis={axis.id}
    >
      {/* HEAD: icon · handle · rank */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-8 w-8 flex-none items-center justify-center rounded-md"
          style={{ backgroundColor: 'rgba(86,86,77,0.07)' }}
        >
          <Icon className="h-4 w-4 text-ink-600" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-ink-400">
              {label.handle || label.title}
            </p>
            <span className="flex-none whitespace-nowrap text-[10px] uppercase tracking-wide text-ink-400">
              {isLoadBearing
                ? `Load · #${axis.load_bearing_rank}`
                : `Refining · #${axis.load_bearing_rank}`}
            </span>
          </div>
        </div>
      </div>

      {/* BODY: the distilled answer (plain English) */}
      <div className="mt-3 min-h-[3rem]">
        {!claim ? (
          <p className="text-sm text-ink-400">Reading…</p>
        ) : !editing && showCandidates ? (
          <div>
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
          <p className="text-[17px] font-medium leading-snug text-ink-900">
            {headlineAnswer || (
              <span className="text-ink-400">Reading…</span>
            )}
          </p>
        ) : null}

        {/* DEVIATION: small footnote arrow, always under the answer when present */}
        {claim && !editing && claim.content.deviation?.hotProblem && (
          <div className="mt-3 flex items-start gap-1.5 text-xs leading-snug text-ink-600">
            <CornerDownRight
              className="mt-0.5 h-3.5 w-3.5 flex-none"
              strokeWidth={1.75}
              style={{ color: 'var(--brand, #c64a1f)' }}
            />
            <span className="italic">{claim.content.deviation.hotProblem}</span>
          </div>
        )}
      </div>

      {/* EDIT FORM (only when editing) */}
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
          className="mt-3 space-y-3 border-t border-ink-100 pt-3"
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

      {/* FOOTER: uniform — see why · correct */}
      {claim && !editing && (
        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between gap-2 border-t border-ink-100 pt-2.5">
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-ink-500 hover:text-ink-800"
              disabled={evidenceCount === 0}
              aria-disabled={evidenceCount === 0}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" /> hide why
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" /> see why
                  {evidenceCount > 0 && (
                    <span className="ml-1 text-ink-400">· {evidenceCount}</span>
                  )}
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
            <div className="mt-3 space-y-2.5 text-xs leading-snug text-ink-600">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[10px] uppercase tracking-wider text-ink-400">Position</span>
                <code className="rounded bg-ink-50 px-1.5 py-0.5 text-[11px] text-ink-700">
                  {claim.content.position}
                </code>
                <span className="text-[11px] text-ink-400">· {label.technical_term}</span>
              </div>
              {claim.content.evidence.length > 0 && (
                <ul className="space-y-1.5">
                  {claim.content.evidence.map((e, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <ProvenanceBadge provenance={e.provenance} />
                      <span>
                        {e.quote}
                        {e.source && (
                          <span className="ml-1 text-ink-400">· {truncateSource(e.source)}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
