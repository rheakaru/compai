'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { AuthGateModal } from './AuthGateModal';
import type { CompanyStack, Suite } from '@/lib/model/stack';

/**
 * Editable notes + structured stack capture. Submitting either re-runs the
 * analysis with the saved data folded into the agent's extra context.
 */
type StackForm = {
  erp: string;
  accounting: string;
  suite: Suite;
  suiteOther: string;
  meetings: string;
  transcriber: string;
  messaging: string;
  operatingFiles: string;
};

const EMPTY_STACK: StackForm = {
  erp: '',
  accounting: '',
  suite: 'none',
  suiteOther: '',
  meetings: '',
  transcriber: '',
  messaging: '',
  operatingFiles: ''
};

function stackFromInitial(s: CompanyStack | null | undefined): StackForm {
  if (!s) return EMPTY_STACK;
  return {
    erp: s.erp ?? '',
    accounting: s.accounting ?? '',
    suite: (s.suite ?? 'none') as Suite,
    suiteOther: s.suiteOther ?? '',
    meetings: s.meetings ?? '',
    transcriber: s.transcriber ?? '',
    messaging: s.messaging ?? '',
    operatingFiles: s.operatingFiles ?? ''
  };
}

function stacksEqual(a: StackForm, b: StackForm): boolean {
  return (
    a.erp === b.erp &&
    a.accounting === b.accounting &&
    a.suite === b.suite &&
    a.suiteOther === b.suiteOther &&
    a.meetings === b.meetings &&
    a.transcriber === b.transcriber &&
    a.messaging === b.messaging &&
    a.operatingFiles === b.operatingFiles
  );
}

export function CompanyNotes({
  companyId,
  companyUrl,
  initialNotes,
  initialStack = null,
  canEdit,
  onReanalyzeComplete,
  onEditStateChange
}: {
  companyId: string;
  companyUrl: string | null;
  initialNotes: string;
  initialStack?: CompanyStack | null;
  canEdit: boolean;
  onReanalyzeComplete?: () => void;
  onEditStateChange?: (s: { editsUsed: number; maxEdits: number }) => void;
}) {
  const { user, getToken } = useAuth();
  const [notes, setNotes] = useState(initialNotes);
  const [savedNotes, setSavedNotes] = useState(initialNotes);
  const [stack, setStack] = useState<StackForm>(stackFromInitial(initialStack));
  const [savedStack, setSavedStack] = useState<StackForm>(stackFromInitial(initialStack));
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'save' | 'reanalyze' | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const notesDirty = notes !== savedNotes;
  const stackDirty = !stacksEqual(stack, savedStack);
  const dirty = notesDirty || stackDirty;
  const hasAnySaved = !!savedNotes || !stacksEqual(savedStack, EMPTY_STACK);

  useEffect(() => {
    setNotes(initialNotes);
    setSavedNotes(initialNotes);
  }, [initialNotes]);

  useEffect(() => {
    const s = stackFromInitial(initialStack);
    setStack(s);
    setSavedStack(s);
  }, [initialStack]);

  const stackPayload = () => ({
    erp: stack.erp,
    accounting: stack.accounting,
    suite: stack.suite,
    suiteOther: stack.suiteOther,
    meetings: stack.meetings,
    transcriber: stack.transcriber,
    messaging: stack.messaging,
    operatingFiles: stack.operatingFiles
  });

  const save = async () => {
    if (!user) {
      setPendingAction('save');
      setAuthOpen(true);
      return;
    }
    if (!dirty) return;
    setSaving(true);
    try {
      const token = await getToken();
      const body: Record<string, unknown> = {};
      if (notesDirty) body.userNotes = notes;
      if (stackDirty) body.stack = stackPayload();
      const res = await fetch(`/api/companies/${companyId}/notes`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json().catch(() => null)) as {
        editState?: { editsUsed: number; maxEdits: number };
      } | null;
      setSavedNotes(notes);
      setSavedStack(stack);
      if (data?.editState && onEditStateChange) onEditStateChange(data.editState);
    } finally {
      setSaving(false);
    }
  };

  const reanalyze = async () => {
    if (!user) {
      setPendingAction('reanalyze');
      setAuthOpen(true);
      return;
    }
    if (dirty) {
      await save();
    }
    if (
      !window.confirm(
        'Re-run the full analysis with these notes and stack as context? This supersedes the current diagnosis (history is preserved). Takes ~1–2 minutes.'
      )
    ) {
      return;
    }
    setReanalyzing(true);
    setProgress(0.05);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const token = await getToken();
      const res = await fetch(`/api/companies/${companyId}/reanalyze`, {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : {},
        signal: ctrl.signal
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let claimsReceived = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n\n')) !== -1) {
          const chunk = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 2);
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              const ev = JSON.parse(line.slice(6));
              if (ev.type === 'claim') {
                claimsReceived++;
                setProgress(Math.min(0.95, 0.05 + claimsReceived * 0.02));
              }
            } catch {
              // ignore
            }
          }
        }
      }
      setProgress(1);
      if (onReanalyzeComplete) {
        onReanalyzeComplete();
      } else {
        window.location.reload();
      }
    } catch {
      // ignore — error will be visible when the page reloads or the user retries
    } finally {
      setReanalyzing(false);
    }
  };

  const readOnly = !canEdit;

  const field = (
    label: string,
    placeholder: string,
    value: string,
    onChange: (v: string) => void
  ) => (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wider text-ink-600">{label}</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={reanalyzing || readOnly}
        placeholder={placeholder}
        className="mt-1 w-full rounded border border-ink-200 bg-white px-2.5 py-1.5 text-sm shadow-sm outline-none placeholder:text-ink-300 focus:border-ink-400 disabled:bg-ink-50"
      />
    </label>
  );

  return (
    <>
      <div className="card">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Your context
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              Free-text notes plus what software you actually run on. Submitting either re-runs the
              diagnosis with this as context — and unlocks the connector map.
            </p>
          </div>
          {companyUrl && (
            <a
              href={companyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-none text-[11px] text-ink-400 hover:text-ink-700"
            >
              {companyUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          )}
        </div>

        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={4}
          disabled={reanalyzing || readOnly}
          placeholder={
            readOnly
              ? 'No notes recorded.'
              : "A few sentences about what the website won't say. Real customers, real numbers, internal SOPs, pricing, who you actually compete with."
          }
          className="mt-3 w-full resize-none rounded border border-ink-200 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-ink-300 focus:border-ink-400 disabled:bg-ink-50"
        />

        {/* Structured stack. Each field is optional; submitting partial data
            is fine. The connector map fires off these + the agent's diagnosis. */}
        <div className="mt-4 rounded border border-ink-100 bg-ink-50/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-600">
            What you actually run on
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            Free text — write what you use, or &quot;none&quot;. Used to suggest specific wires between systems.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {field('ERP / inventory', 'Zoho Inventory, Tally, custom, none…', stack.erp, v =>
              setStack(s => ({ ...s, erp: v }))
            )}
            {field('Accounting', 'Zoho Books, Tally, QuickBooks…', stack.accounting, v =>
              setStack(s => ({ ...s, accounting: v }))
            )}
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-wider text-ink-600">
                Productivity suite
              </span>
              <select
                value={stack.suite}
                onChange={e => setStack(s => ({ ...s, suite: e.target.value as Suite }))}
                disabled={reanalyzing || readOnly}
                className="mt-1 w-full rounded border border-ink-200 bg-white px-2.5 py-1.5 text-sm shadow-sm outline-none focus:border-ink-400 disabled:bg-ink-50"
              >
                <option value="none">None</option>
                <option value="google_workspace">Google Workspace</option>
                <option value="microsoft_365">Microsoft 365</option>
                <option value="zoho">Zoho</option>
                <option value="other">Other</option>
              </select>
            </label>
            {stack.suite === 'other' &&
              field('Which suite?', 'name it', stack.suiteOther, v =>
                setStack(s => ({ ...s, suiteOther: v }))
              )}
            {field('Meetings', 'Zoom, Meet, Teams…', stack.meetings, v =>
              setStack(s => ({ ...s, meetings: v }))
            )}
            {field('AI transcriber', 'Fireflies, Otter, Granola, none…', stack.transcriber, v =>
              setStack(s => ({ ...s, transcriber: v }))
            )}
            {field('Internal messaging', 'Slack, Teams, WhatsApp, email…', stack.messaging, v =>
              setStack(s => ({ ...s, messaging: v }))
            )}
          </div>
          <label className="mt-3 block">
            <span className="text-[11px] font-medium uppercase tracking-wider text-ink-600">
              Files the operation actually runs on
            </span>
            <textarea
              value={stack.operatingFiles}
              onChange={e => setStack(s => ({ ...s, operatingFiles: e.target.value }))}
              rows={3}
              disabled={reanalyzing || readOnly}
              placeholder="The 2–3 spreadsheets/docs your team opens every day — the order tracker, the daily P&L, the inventory sheet."
              className="mt-1 w-full resize-none rounded border border-ink-200 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-ink-300 focus:border-ink-400 disabled:bg-ink-50"
            />
          </label>
        </div>

        {!readOnly && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[11px] text-ink-400">
              {reanalyzing
                ? `Re-running analysis… ${Math.round(progress * 100)}%`
                : dirty
                  ? 'Unsaved changes — each save uses one edit'
                  : hasAnySaved
                    ? 'Saved.'
                    : 'No context yet.'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving || reanalyzing}
                className="rounded border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={reanalyze}
                disabled={reanalyzing || (!hasAnySaved && !dirty)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:bg-ink-300"
                style={{
                  backgroundColor: reanalyzing || (!hasAnySaved && !dirty) ? undefined : 'var(--brand, #c64a1f)'
                }}
              >
                {reanalyzing ? 'Re-analyzing…' : 'Re-run analysis'}
              </button>
            </div>
          </div>
        )}

        {reanalyzing && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full transition-all"
              style={{
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: 'var(--brand, #c64a1f)'
              }}
            />
          </div>
        )}
      </div>

      <AuthGateModal
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
          setPendingAction(null);
        }}
        onSignedIn={() => {
          setAuthOpen(false);
          if (pendingAction === 'save') void save();
          if (pendingAction === 'reanalyze') void reanalyze();
          setPendingAction(null);
        }}
      />
    </>
  );
}
