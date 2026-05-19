'use client';

import { useState } from 'react';
import type {
  GateCommitmentConfig,
  GateCommitmentField,
  PaymentToggle
} from '@/lib/gate/commitment';

/**
 * The session-plan gate UI. ONE component, ONE config object — this is the
 * seam. Replacing the commitment means swapping `PLACEHOLDER_COMMITMENT`
 * in lib/gate/commitment.ts; this component renders whatever fields the
 * config specifies. To A/B a payment variant, flip the payment_toggle in
 * ontology.yaml — no code change.
 */
export function GateCommitmentPanel({
  commitment,
  payment,
  companyName,
  onSubmit,
  submitting,
  error
}: {
  commitment: GateCommitmentConfig;
  payment: PaymentToggle;
  companyName: string | null;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  submitting: boolean;
  error: string | null;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seeded: Record<string, string> = {};
    for (const f of commitment.fields) {
      if (f.id === 'companyName' && companyName) seeded[f.id] = companyName;
      else seeded[f.id] = '';
    }
    return seeded;
  });

  const handleField = (field: GateCommitmentField, v: string) => {
    setValues(prev => ({ ...prev, [field.id]: v }));
  };

  return (
    <form
      onSubmit={async e => {
        e.preventDefault();
        await onSubmit(values);
      }}
      className="card border-l-4"
      style={{ borderLeftColor: 'var(--brand, #c64a1f)' }}
    >
      <h3 className="text-lg font-semibold text-ink-900">{commitment.title}</h3>
      <p className="mt-1 text-sm text-ink-600">{commitment.rationale}</p>
      {commitment.isPlaceholder && (
        <p className="mt-2 text-[11px] uppercase tracking-wider text-amber-700">
          Placeholder gate — operator still deciding the final commitment mechanism
        </p>
      )}

      <div className="mt-4 space-y-3">
        {commitment.fields.map(field => (
          <FieldRow
            key={field.id}
            field={field}
            value={values[field.id] ?? ''}
            onChange={v => handleField(field, v)}
          />
        ))}
      </div>

      {payment.enabled && (
        <div className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Payment variant ON — ₹{(payment.amountInr / 100).toLocaleString('en-IN')} secures the
          slot. (Configured via ontology.yaml{' '}
          <span className="font-mono">session_projection.gate.payment_toggle</span>.)
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 w-full rounded-md px-4 py-2.5 text-sm font-medium text-white disabled:bg-ink-300"
        style={{ backgroundColor: submitting ? undefined : 'var(--brand, #c64a1f)' }}
      >
        {submitting ? 'Projecting your one day…' : commitment.submitLabel}
      </button>
      {error && (
        <p className="mt-3 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </p>
      )}
    </form>
  );
}

function FieldRow({
  field,
  value,
  onChange
}: {
  field: GateCommitmentField;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-ink-500">
        {field.label}
        {field.required && <span className="ml-1 text-rose-600">*</span>}
      </label>
      {field.hint && <p className="text-[11px] text-ink-400">{field.hint}</p>}
      {field.type === 'textarea' ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-none rounded border border-ink-200 bg-white px-3 py-2 text-sm"
        />
      ) : field.type === 'select' ? (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="mt-1 w-full rounded border border-ink-200 bg-white px-3 py-2 text-sm"
        >
          {(field.options ?? []).map(opt => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="mt-1 w-full rounded border border-ink-200 bg-white px-3 py-2 text-sm"
        />
      )}
    </div>
  );
}
