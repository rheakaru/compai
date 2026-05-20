'use client';

import { useCallback, useState } from 'react';
import { Download, Copy, X } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { AuthGateModal } from './AuthGateModal';
import type { ExportGateLevel } from '@/lib/ontology/types';
import { describeExportGate } from '@/lib/export/gate';

/**
 * Export-the-diagnosis-for-an-LLM button.
 *
 * Hard constraints from the patch and the ontology context_graph_export block:
 * - Markdown only. No JSON option, no second format.
 * - Method preamble is default-on. The toggle removes it; there is no opt-in.
 * - Every claim must carry its provenance (handled in the serializer).
 * - Gate is operator-tunable (ontology: export_gate_level). With the gate at
 *   profile_edit, this is "the action a logged-in user can take once the
 *   diagnosis is in" — the affordance shows always; clicking signed-out opens
 *   the auth modal.
 */
export function ContextExportButton({
  companyId,
  companyName,
  gateOpen,
  gateLevel
}: {
  companyId: string;
  companyName: string | null;
  gateOpen: boolean;
  gateLevel: ExportGateLevel;
}) {
  const { user, getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [includePreamble, setIncludePreamble] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchExport = useCallback(
    async (withPreamble: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const res = await fetch(
          `/api/companies/${companyId}/export?preamble=${withPreamble ? '1' : '0'}`,
          { headers: token ? { authorization: `Bearer ${token}` } : {} }
        );
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
        }
        const text = await res.text();
        setMarkdown(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [companyId, getToken]
  );

  const openModal = async () => {
    // Auth-gate: signed-out users get the sign-in prompt; we resume into the
    // export modal automatically once they're signed in.
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setOpen(true);
    if (!markdown) await fetchExport(includePreamble);
  };

  const togglePreamble = async () => {
    const next = !includePreamble;
    setIncludePreamble(next);
    await fetchExport(next);
  };

  const copyToClipboard = async () => {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Clipboard blocked — select and copy from the box below.');
    }
  };

  const download = () => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (companyName ?? 'company').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.download = `compai-${safeName}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={!gateOpen}
        className="card flex w-full items-center justify-between gap-3 text-left enabled:hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--brand, #c64a1f)' }}
          >
            Export this diagnosis for your LLM
          </p>
          <p className="mt-1 text-sm text-ink-700">
            {gateOpen ? (
              <>
                Paste it into ChatGPT, Claude, or hand it to your dev. A Markdown context
                document — the only artifact designed to leave the tool.
              </>
            ) : (
              <>
                A Markdown context you can paste into any LLM to get sharper answers about
                your business. {describeExportGate(gateLevel)}.
              </>
            )}
          </p>
        </div>
        <Download className="h-5 w-5 flex-none text-ink-500" strokeWidth={1.75} />
      </button>

      <AuthGateModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSignedIn={async () => {
          setAuthOpen(false);
          setOpen(true);
          if (!markdown) await fetchExport(includePreamble);
        }}
      />

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-6">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-ink-200 bg-white shadow-xl">
            <div className="flex items-baseline justify-between gap-4 border-b border-ink-200 px-5 py-3">
              <div>
                <h2 className="text-base font-semibold text-ink-900">
                  Context graph export · Markdown
                </h2>
                <p className="text-[11px] text-ink-500">
                  Markdown is the only format offered. Technical users can
                  convert this further in one prompt.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 border-b border-ink-100 bg-ink-50/40 px-5 py-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includePreamble}
                  onChange={() => void togglePreamble()}
                  disabled={loading}
                />
                <span>
                  <span className="font-medium">Include method preamble</span>{' '}
                  <span className="text-ink-500">(on by default; uncheck to strip)</span>
                </span>
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loading && <p className="text-sm text-ink-500">Serialising the live projection…</p>}
              {error && (
                <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                  {error}
                </p>
              )}
              {markdown && (
                <textarea
                  readOnly
                  value={markdown}
                  className="h-[55vh] w-full resize-none rounded border border-ink-200 bg-ink-50 px-3 py-2 font-mono text-[12px] leading-snug text-ink-800"
                  onFocus={e => e.currentTarget.select()}
                />
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-ink-200 px-5 py-3">
              <p className="text-[11px] text-ink-500">
                Re-export anytime — corrections you make on this page show up
                immediately in the next export. It is a live serialisation, not
                a snapshot.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  disabled={!markdown || loading}
                  className="flex items-center gap-1.5 rounded border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={download}
                  disabled={!markdown || loading}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--brand, #c64a1f)' }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download .md
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
