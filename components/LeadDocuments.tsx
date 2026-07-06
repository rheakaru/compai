'use client';

// Client documents — uploaded briefs/files (Rhai reads them) and Rhai-
// generated drafts (proposals, emails). The viewer renders markdown cleanly,
// lets Rhea iterate with Rhai like a Claude artifact, and exports a clean
// file to send to clients (.md / .txt / print-to-PDF).

import { marked } from 'marked';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useAuthedFetch } from './useAuthedFetch';
import type { LeadDocument } from '@/lib/leads/types';

type DocMeta = Omit<LeadDocument, 'text' | 'versions'> & { hasText?: boolean };

function renderMd(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  // Operator-only internal tool, but strip the obvious script vectors anyway.
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/ on\w+="[^"]*"/gi, '');
}

/** Best-effort markdown → clean plain text for a "normal file" export. */
function toPlainText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)')
    .replace(/^\s*>\s?/gm, '')
    .trim();
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Section on the client workspace
// ---------------------------------------------------------------------------

export function DocumentsSection({ leadId }: { leadId: string }) {
  const authedFetch = useAuthedFetch();
  const { getToken } = useAuth();
  const [docs, setDocs] = useState<DocMeta[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const res = await authedFetch(`/api/leads/${leadId}/documents`);
    if (res.ok) setDocs(((await res.json()) as { documents: DocMeta[] }).documents);
  }, [authedFetch, leadId]);

  useEffect(() => {
    load().catch(() => undefined);
    const onChanged = () => load().catch(() => undefined);
    const onOpen = (e: Event) => {
      const docId = (e as CustomEvent<{ docId?: string }>).detail?.docId;
      if (docId) {
        setOpenId(docId);
        load().catch(() => undefined); // a fresh generated doc may not be listed yet
      }
    };
    window.addEventListener('rhai:docsChanged', onChanged);
    window.addEventListener('rhai:openDoc', onOpen);
    return () => {
      window.removeEventListener('rhai:docsChanged', onChanged);
      window.removeEventListener('rhai:openDoc', onOpen);
    };
  }, [load]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const token = await getToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/leads/${leadId}/documents`, {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: fd
      });
      if (res.ok) await load();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    setDocs(prev => (prev ? prev.filter(d => d.id !== docId) : prev));
    await authedFetch(`/api/leads/${leadId}/documents/${docId}`, { method: 'DELETE' }).catch(() => undefined);
  };

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="eyebrow">Documents</p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-md border border-ink-200 px-2.5 py-1 text-[11px] text-ink-700 hover:bg-ink-50 disabled:opacity-50"
        >
          {uploading ? 'Reading…' : '↑ Upload'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.md,.csv,.xlsx,.xls,.json,application/pdf,text/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
      </div>
      <p className="mb-2 text-[11px] text-ink-400">
        PDFs, Excels, briefs — Rhai reads them into this client&apos;s understanding. Drafts Rhai writes land here too.
      </p>

      {docs === null ? (
        <p className="text-xs text-ink-400">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-[11px] text-ink-400">Nothing yet — upload a brief, or run a draft task.</p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map(d => (
            <li key={d.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpenId(d.id)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-cream-50"
              >
                <span className="text-sm">{d.origin === 'generated' ? '✍️' : '📄'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink-800">{d.name}</span>
                  <span className="block text-[10px] text-ink-400">
                    {d.origin === 'generated' ? 'Rhai draft' : d.kind} ·{' '}
                    {new Date(d.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => remove(d.id)}
                className="shrink-0 text-[11px] text-ink-300 hover:text-rose-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {openId && (
        <DocumentViewer
          leadId={leadId}
          docId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => window.dispatchEvent(new Event('rhai:docsChanged'))}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full-screen viewer: read, refine with Rhai, download
// ---------------------------------------------------------------------------

function DocumentViewer({
  leadId,
  docId,
  onClose,
  onChanged
}: {
  leadId: string;
  docId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const authedFetch = useAuthedFetch();
  const { getToken } = useAuth();
  const [doc, setDoc] = useState<LeadDocument | null>(null);
  const [feedback, setFeedback] = useState('');
  const [refining, setRefining] = useState(false);

  useEffect(() => {
    authedFetch(`/api/leads/${leadId}/documents/${docId}`)
      .then(async r => (r.ok ? setDoc(((await r.json()) as { document: LeadDocument }).document) : undefined))
      .catch(() => undefined);
  }, [authedFetch, leadId, docId]);

  const refine = async () => {
    const f = feedback.trim();
    if (!f || refining || !doc) return;
    setRefining(true);
    try {
      const res = await authedFetch(`/api/leads/${leadId}/documents/${docId}/refine`, {
        method: 'POST',
        body: JSON.stringify({ feedback: f })
      });
      if (res.ok) {
        setDoc(((await res.json()) as { document: LeadDocument }).document);
        setFeedback('');
        onChanged();
      }
    } finally {
      setRefining(false);
    }
  };

  const printPdf = () => {
    if (!doc) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${doc.name}</title><style>
      body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.6;color:#1a1a16}
      h1,h2,h3{font-family:Georgia,serif;line-height:1.2}
      table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 10px;text-align:left}
      code{background:#f4f1ea;padding:1px 4px;border-radius:3px}
      @media print{body{margin:0}}
    </style></head><body>${renderMd(doc.text)}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const downloadOriginal = async () => {
    if (!doc?.storagePath) return;
    const token = await getToken();
    const res = await fetch(`/api/leads/${leadId}/documents/${docId}/file`, {
      headers: token ? { authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isGenerated = doc?.origin === 'generated';
  const baseName = (doc?.name ?? 'document').replace(/\.[^.]+$/, '');

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-ink-900/30 p-4 sm:p-8" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-ink-200 bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink-200 bg-cream-50 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">{doc?.name ?? 'Loading…'}</p>
            {doc && (
              <p className="text-[10px] text-ink-400">
                {isGenerated ? 'Rhai draft' : `uploaded · ${doc.kind}`}
                {doc.versions?.length ? ` · v${doc.versions.length + 1}` : ''}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {doc && (
              <>
                <button
                  type="button"
                  onClick={() => download(`${baseName}.md`, doc.text, 'text/markdown')}
                  className="rounded border border-ink-200 px-2 py-1 text-[11px] text-ink-600 hover:bg-ink-50"
                >
                  .md
                </button>
                <button
                  type="button"
                  onClick={() => download(`${baseName}.txt`, toPlainText(doc.text), 'text/plain')}
                  className="rounded border border-ink-200 px-2 py-1 text-[11px] text-ink-600 hover:bg-ink-50"
                >
                  .txt
                </button>
                <button
                  type="button"
                  onClick={printPdf}
                  className="rounded border border-ink-200 px-2 py-1 text-[11px] text-ink-600 hover:bg-ink-50"
                >
                  PDF
                </button>
                {doc.storagePath && (
                  <button
                    type="button"
                    onClick={downloadOriginal}
                    className="rounded border border-ink-200 px-2 py-1 text-[11px] text-ink-600 hover:bg-ink-50"
                  >
                    original
                  </button>
                )}
              </>
            )}
            <button type="button" onClick={onClose} className="rounded px-2 py-1 text-ink-400 hover:bg-ink-100">
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {doc ? (
            <div
              className="prose-doc text-sm leading-relaxed text-ink-800 [&_h1]:mt-0 [&_h1]:font-display [&_h1]:text-2xl [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-lg [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:my-0.5 [&_p]:my-2 [&_table]:my-3 [&_table]:w-full [&_table]:text-xs [&_td]:border [&_td]:border-ink-100 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-ink-200 [&_th]:bg-cream-50 [&_th]:px-2 [&_th]:py-1 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: renderMd(doc.text) }}
            />
          ) : (
            <p className="text-sm text-ink-400">Loading…</p>
          )}
        </div>

        {isGenerated && (
          <div className="border-t border-ink-200 bg-cream-50 p-3">
            <p className="mb-1.5 text-[11px] text-ink-500">
              Refine with Rhai — tell it what to change and it rewrites the whole doc (and learns your preferences for
              next time).
            </p>
            <div className="flex items-end gap-2">
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    refine();
                  }
                }}
                rows={2}
                placeholder='e.g. "make it warmer and shorter", "add a phased pricing table", "lead with the recce day"'
                className="flex-1 resize-none rounded-md border border-ink-200 px-2.5 py-2 text-xs focus:border-ink-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={refine}
                disabled={refining || !feedback.trim()}
                className="rounded-md bg-ink-900 px-3 py-2 text-xs font-medium text-cream hover:bg-ink-800 disabled:opacity-50"
              >
                {refining ? 'Rewriting…' : 'Refine'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
