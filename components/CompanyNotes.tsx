'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { AuthGateModal } from './AuthGateModal';

/**
 * Editable notes box that lives at the top of the company profile.
 * Stores arbitrary text on the company doc. Two actions:
 *   - Save (just persists the notes)
 *   - Re-run analysis (uses the saved notes as extra context, replaces
 *     the diagnosis via /api/companies/[id]/reanalyze)
 *
 * Both require auth; the auth modal opens if the user isn't signed in.
 */
export function CompanyNotes({
  companyId,
  companyUrl,
  initialNotes,
  canEdit,
  onReanalyzeComplete
}: {
  companyId: string;
  companyUrl: string | null;
  initialNotes: string;
  canEdit: boolean;
  onReanalyzeComplete?: () => void;
}) {
  const { user, getToken } = useAuth();
  const [notes, setNotes] = useState(initialNotes);
  const [savedNotes, setSavedNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'save' | 'reanalyze' | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const dirty = notes !== savedNotes;

  useEffect(() => {
    setNotes(initialNotes);
    setSavedNotes(initialNotes);
  }, [initialNotes]);

  const save = async () => {
    if (!user) {
      setPendingAction('save');
      setAuthOpen(true);
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/companies/${companyId}/notes`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ userNotes: notes })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedNotes(notes);
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
        'Re-run the full analysis with these notes as context? This supersedes the current diagnosis (history is preserved). Takes ~1–2 minutes.'
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
      // Soft reload so the SSR page picks up the new claims.
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

  if (!canEdit) return null;

  return (
    <>
      <div className="card">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Your context
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              Anything the public web won&apos;t tell us — pricing details, real customers, internal
              constraints. Save it. When you re-run the analysis, the agent reads these notes as
              context and revises the diagnosis.
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
          disabled={reanalyzing}
          placeholder="A few sentences about what the website won't say. Real customers, real numbers, internal SOPs, pricing, who you actually compete with."
          className="mt-3 w-full resize-none rounded border border-ink-200 bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-ink-300 focus:border-ink-400 disabled:bg-ink-50"
        />

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-[11px] text-ink-400">
            {reanalyzing
              ? `Re-running analysis… ${Math.round(progress * 100)}%`
              : dirty
                ? 'Unsaved changes'
                : savedNotes
                  ? 'Saved.'
                  : 'No notes yet.'}
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
              disabled={reanalyzing || (!savedNotes && !dirty)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:bg-ink-300"
              style={{
                backgroundColor: reanalyzing || (!savedNotes && !dirty) ? undefined : 'var(--brand, #c64a1f)'
              }}
            >
              {reanalyzing ? 'Re-analyzing…' : 'Re-run analysis'}
            </button>
          </div>
        </div>

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
