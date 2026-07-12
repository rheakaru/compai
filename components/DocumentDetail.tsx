'use client';

// Full-page view of one client document: the document as a readable
// rendered-markdown body, export actions, and a chat rail to iterate on it
// with Rhai — edits (on generated drafts) replace the body in place and learn
// Rhea's preferences. Mirrors the task detail page. Operator-only.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useAuthedFetch } from './useAuthedFetch';
import { PROSE_CLASS, renderMarkdown } from '@/lib/markdown';
import type { LeadDocument } from '@/lib/leads/types';

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
function saveFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function DocumentDetail({ leadId, docId }: { leadId: string; docId: string }) {
  const { user, signIn, getToken } = useAuth();
  const authedFetch = useAuthedFetch();
  const [doc, setDoc] = useState<LeadDocument | null | 'missing'>(null);
  const [flash, setFlash] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await authedFetch(`/api/leads/${leadId}/documents/${docId}`);
    if (res.status === 404) return setDoc('missing');
    if (res.ok) setDoc(((await res.json()) as { document: LeadDocument }).document);
  }, [authedFetch, leadId, docId]);

  useEffect(() => {
    if (user) load().catch(() => undefined);
  }, [user, load]);

  if (!user)
    return (
      <Shell>
        <p className="text-sm text-ink-700">Sign in with the operator account to view this document.</p>
        <button type="button" onClick={() => signIn().catch(() => undefined)} className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600">
          Sign in with Google
        </button>
      </Shell>
    );
  if (doc === 'missing')
    return (
      <Shell>
        <p className="text-sm text-ink-500">This document doesn&apos;t exist (or was deleted).</p>
        <Link href={`/leads/${leadId}`} className="mt-3 inline-block text-sm text-accent hover:underline">← Back to the client</Link>
      </Shell>
    );
  if (!doc)
    return (
      <Shell>
        <p className="text-sm text-ink-400">Loading…</p>
      </Shell>
    );

  const isGenerated = doc.origin === 'generated';
  const baseName = doc.name.replace(/\.[^.]+$/, '');

  const copy = () => {
    navigator.clipboard.writeText(doc.text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const printPdf = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${doc.name}</title><style>
      body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.6;color:#1a1a16}
      h1,h2,h3{font-family:Georgia,serif;line-height:1.2}
      table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 10px;text-align:left}
      code{background:#f4f1ea;padding:1px 4px;border-radius:3px}@media print{body{margin:0}}
    </style></head><body>${renderMarkdown(doc.text)}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };
  const downloadOriginal = async () => {
    const token = await getToken();
    const res = await fetch(`/api/leads/${leadId}/documents/${docId}/file`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = doc.name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onEdited = (text: string) => {
    setDoc(d => (d && d !== 'missing' ? { ...d, text } : d));
    setFlash(true);
    setTimeout(() => setFlash(false), 1200);
  };
  const onChat = (chat: NonNullable<LeadDocument['chat']>) => setDoc(d => (d && d !== 'missing' ? { ...d, chat } : d));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href={`/leads/${leadId}`} className="text-xs text-ink-400 hover:text-ink-700">← Back to the client</Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{isGenerated ? 'Rhai draft' : `Uploaded · ${doc.kind}`}</p>
          <h1 className="mt-1 font-display text-2xl tracking-tight text-ink-900">{doc.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <button type="button" onClick={copy} className="rounded-md border border-ink-200 px-2.5 py-1 text-ink-600 hover:bg-ink-50">{copied ? 'Copied ✓' : 'Copy'}</button>
          <button type="button" onClick={() => saveFile(`${baseName}.md`, doc.text, 'text/markdown')} className="rounded-md border border-ink-200 px-2.5 py-1 text-ink-600 hover:bg-ink-50">.md</button>
          <button type="button" onClick={() => saveFile(`${baseName}.txt`, toPlainText(doc.text), 'text/plain')} className="rounded-md border border-ink-200 px-2.5 py-1 text-ink-600 hover:bg-ink-50">.txt</button>
          <button type="button" onClick={printPdf} className="rounded-md border border-ink-200 px-2.5 py-1 text-ink-600 hover:bg-ink-50">PDF</button>
          {doc.storagePath && <button type="button" onClick={downloadOriginal} className="rounded-md border border-ink-200 px-2.5 py-1 text-ink-600 hover:bg-ink-50">original</button>}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className={`rounded-lg border bg-white p-6 transition-colors ${flash ? 'border-accent' : 'border-ink-200'}`}>
          <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.text) }} />
        </div>

        <DocChat leadId={leadId} docId={docId} doc={doc} editable={isGenerated} authedFetch={authedFetch} onEdited={onEdited} onChat={onChat} />
      </div>
    </div>
  );
}

function DocChat({
  leadId,
  docId,
  doc,
  editable,
  authedFetch,
  onEdited,
  onChat
}: {
  leadId: string;
  docId: string;
  doc: LeadDocument;
  editable: boolean;
  authedFetch: (p: string, i?: RequestInit) => Promise<Response>;
  onEdited: (text: string) => void;
  onChat: (chat: NonNullable<LeadDocument['chat']>) => void;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chat = doc.chat ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.length, sending]);

  const send = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setDraft('');
    setSending(true);
    const now = Date.now();
    const base = doc.chat ?? [];
    onChat([...base, { role: 'rhea', text: message, at: now }]);
    try {
      const res = await authedFetch(`/api/leads/${leadId}/documents/${docId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message })
      });
      if (!res.ok) {
        onChat([...base, { role: 'rhea', text: message, at: now }, { role: 'rhai', text: 'Sorry — something went wrong. Try again.', at: Date.now() }]);
        return;
      }
      const d = (await res.json()) as { reply: string; updatedText: string | null };
      onChat([...base, { role: 'rhea', text: message, at: now }, { role: 'rhai', text: d.reply, at: Date.now() }]);
      if (d.updatedText) onEdited(d.updatedText);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[74vh] flex-col overflow-hidden rounded-lg border border-ink-200 bg-white lg:sticky lg:top-4">
      <div className="border-b border-ink-100 bg-cream-50 px-4 py-2.5">
        <p className="eyebrow">Chat with Rhai</p>
        <p className="text-[11px] text-ink-500">
          {editable ? 'Ask for edits — “make it warmer”, “add a pricing table” — and the doc updates.' : 'Uploaded file — ask Rhai about it (edits apply to drafts).'}
        </p>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {chat.length === 0 && (
          <p className="px-1 text-[11px] leading-relaxed text-ink-400">
            {editable
              ? 'Nothing yet. Try “tighten the intro”, “add a phased pricing table”, or “make it sound more like me”.'
              : 'Ask a question about this file — “what did they say about timelines?”'}
          </p>
        )}
        {chat.map((m, i) => (
          <div key={i} className={m.role === 'rhea' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[12px] leading-relaxed ${m.role === 'rhea' ? 'bg-ink-900 text-cream' : 'border border-ink-200 bg-cream-50 text-ink-800'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {sending && <p className="px-1 text-[11px] text-ink-400">Rhai is working…</p>}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-ink-100 p-2.5">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder={editable ? 'Ask Rhai to edit or explain…' : 'Ask Rhai about this file…'}
            className="flex-1 resize-none rounded-md border border-ink-200 px-2.5 py-1.5 text-[12px] leading-relaxed focus:border-ink-400 focus:outline-none"
          />
          <button type="button" onClick={send} disabled={sending || !draft.trim()} className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-600 disabled:opacity-50">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl px-6 py-16">{children}</div>;
}
