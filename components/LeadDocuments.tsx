'use client';

// Client documents — uploaded briefs/files (Rhai reads them) and Rhai-
// generated drafts (proposals, emails). Each opens as a full page
// (/leads/[id]/documents/[docId]) with a readable rendered body, export
// actions, and a chat rail to iterate with Rhai — same as the task page.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { useAuthedFetch } from './useAuthedFetch';
import type { LeadDocument } from '@/lib/leads/types';

type DocMeta = Omit<LeadDocument, 'text' | 'versions' | 'chat'> & { hasText?: boolean };

export function DocumentsSection({ leadId }: { leadId: string }) {
  const authedFetch = useAuthedFetch();
  const { getToken } = useAuth();
  const router = useRouter();
  const [docs, setDocs] = useState<DocMeta[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const openDoc = useCallback((docId: string) => router.push(`/leads/${leadId}/documents/${docId}`), [router, leadId]);

  const load = useCallback(async () => {
    const res = await authedFetch(`/api/leads/${leadId}/documents`);
    if (res.ok) setDocs(((await res.json()) as { documents: DocMeta[] }).documents);
  }, [authedFetch, leadId]);

  useEffect(() => {
    load().catch(() => undefined);
    const onChanged = () => load().catch(() => undefined);
    const onOpen = (e: Event) => {
      const docId = (e as CustomEvent<{ docId?: string }>).detail?.docId;
      if (docId) openDoc(docId);
    };
    window.addEventListener('rhai:docsChanged', onChanged);
    window.addEventListener('rhai:openDoc', onOpen);
    return () => {
      window.removeEventListener('rhai:docsChanged', onChanged);
      window.removeEventListener('rhai:openDoc', onOpen);
    };
  }, [load, openDoc]);

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
        Click one to open it full-page and chat-to-edit with Rhai.
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
                onClick={() => openDoc(d.id)}
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
                <span className="shrink-0 text-[11px] text-indigo-600">Open →</span>
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
    </div>
  );
}
