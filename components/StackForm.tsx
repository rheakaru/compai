'use client';

import { useState } from 'react';
import type { Suite } from '@/lib/model/stack';

export interface StackFormValues {
  erp: string;
  accounting: string;
  suite: Suite;
  suiteOther: string;
  notes: string;
  extraDetail: string;
}

export function StackForm({
  onSubmit,
  submitting
}: {
  onSubmit: (v: StackFormValues) => Promise<void>;
  submitting: boolean;
}) {
  const [v, setV] = useState<StackFormValues>({
    erp: '',
    accounting: '',
    suite: 'google_workspace',
    suiteOther: '',
    notes: '',
    extraDetail: ''
  });

  return (
    <form
      onSubmit={async e => {
        e.preventDefault();
        await onSubmit(v);
      }}
      className="space-y-4"
    >
      <Field label="ERP" hint="What runs your operations? (e.g. SAP, Odoo, custom, none)">
        <input
          value={v.erp}
          onChange={e => setV({ ...v, erp: e.target.value })}
          className="w-full rounded border border-ink-200 bg-white px-3 py-2 text-sm"
          placeholder="ERP / 'none'"
        />
      </Field>
      <Field label="Accounting" hint="Books software — Zoho Books, QuickBooks, Tally, NetSuite, etc.">
        <input
          value={v.accounting}
          onChange={e => setV({ ...v, accounting: e.target.value })}
          className="w-full rounded border border-ink-200 bg-white px-3 py-2 text-sm"
          placeholder="Accounting software"
        />
      </Field>
      <Field label="Business suite" hint="Email, docs, sheets — where work actually lives.">
        <select
          value={v.suite}
          onChange={e => setV({ ...v, suite: e.target.value as Suite })}
          className="w-full rounded border border-ink-200 bg-white px-3 py-2 text-sm"
        >
          <option value="google_workspace">Google Workspace</option>
          <option value="microsoft_365">Microsoft 365</option>
          <option value="zoho">Zoho One</option>
          <option value="other">Other</option>
          <option value="none">None / mixed</option>
        </select>
      </Field>
      {v.suite === 'other' && (
        <Field label="Which one?">
          <input
            value={v.suiteOther}
            onChange={e => setV({ ...v, suiteOther: e.target.value })}
            className="w-full rounded border border-ink-200 bg-white px-3 py-2 text-sm"
            placeholder="Notion + Slack + …"
          />
        </Field>
      )}
      <Field
        label="Anything else core"
        hint="Tools you'd be helpless without. CRM, warehouse, fleet — anything."
      >
        <input
          value={v.notes}
          onChange={e => setV({ ...v, notes: e.target.value })}
          className="w-full rounded border border-ink-200 bg-white px-3 py-2 text-sm"
          placeholder="HubSpot, Razorpay, …"
        />
      </Field>
      <Field
        label="What's actually keeping you up at night?"
        hint="A few sentences. This goes straight into the project generator as a feasibility input."
      >
        <textarea
          value={v.extraDetail}
          onChange={e => setV({ ...v, extraDetail: e.target.value })}
          rows={4}
          className="w-full resize-none rounded border border-ink-200 bg-white px-3 py-2 text-sm"
          placeholder="The problem you'd most like to delete from your calendar."
        />
      </Field>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-600 disabled:bg-ink-300"
      >
        {submitting ? 'Generating your five projects…' : 'Generate your 5 AI projects'}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-ink-500">{label}</label>
      {hint && <p className="text-[11px] text-ink-400">{hint}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}
