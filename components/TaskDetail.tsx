'use client';

// Full-page view of one Rhai task: the whole prompt on top, the deliverable as
// a readable rendered-markdown body, and a chat rail to iterate on it with Rhai
// (edits replace the body in place). Operator-only.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useAuthedFetch } from './useAuthedFetch';
import { PROSE_CLASS, renderMarkdown } from '@/lib/markdown';
import type { RhaiTask } from '@/lib/rhai/types';

export function TaskDetail({ id }: { id: string }) {
  const { user, signIn } = useAuth();
  const authedFetch = useAuthedFetch();
  const [task, setTask] = useState<RhaiTask | null | 'missing'>(null);

  const load = useCallback(async () => {
    const res = await authedFetch(`/api/rhai/tasks/${id}`);
    if (res.status === 404) return setTask('missing');
    if (res.ok) setTask(((await res.json()) as { task: RhaiTask }).task);
  }, [authedFetch, id]);

  useEffect(() => {
    if (user) load().catch(() => undefined);
  }, [user, load]);

  if (!user) {
    return (
      <Shell>
        <p className="text-sm text-ink-700">Sign in with the operator account to view this task.</p>
        <button
          type="button"
          onClick={() => signIn().catch(() => undefined)}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
        >
          Sign in with Google
        </button>
      </Shell>
    );
  }
  if (task === 'missing')
    return (
      <Shell>
        <p className="text-sm text-ink-500">This task doesn&apos;t exist (or was deleted).</p>
        <Link href="/leads" className="mt-3 inline-block text-sm text-accent hover:underline">
          ← Back to Rhai
        </Link>
      </Shell>
    );
  if (!task)
    return (
      <Shell>
        <p className="text-sm text-ink-400">Loading…</p>
      </Shell>
    );

  return <Loaded task={task} onReload={load} setTask={t => setTask(t)} authedFetch={authedFetch} />;
}

function Loaded({
  task,
  setTask,
  authedFetch
}: {
  task: RhaiTask;
  onReload: () => Promise<void>;
  setTask: (t: RhaiTask) => void;
  authedFetch: (p: string, i?: RequestInit) => Promise<Response>;
}) {
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(task.result ?? '').catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const download = () => {
    const blob = new Blob([task.result ?? ''], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${task.title.slice(0, 60).replace(/[^\w\s-]/g, '').trim() || 'task'}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onEdited = (updated: string) => {
    setTask({ ...task, result: updated });
    setFlash(true);
    setTimeout(() => setFlash(false), 1200);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/leads" className="text-xs text-ink-400 hover:text-ink-700">
        ← Rhai · Tasks
      </Link>

      {/* Prompt on top */}
      <div className="mt-3 rounded-lg border border-ink-200 bg-white p-5">
        <p className="eyebrow">Your prompt</p>
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-900">{task.detail || task.title}</p>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
          <StatusChip status={task.status} />
          {task.leadLabel && <span>· {task.leadLabel}</span>}
          {task.skillId && <span>· skill: {task.skillId}</span>}
          <span>
            · {new Date(task.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
          {task.finishedAt && task.startedAt && <span>· ran in {Math.round((task.finishedAt - task.startedAt) / 1000)}s</span>}
        </p>
        {task.error && <p className="mt-2 text-xs text-rose-600">{task.error}</p>}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Result body */}
        <div className={`rounded-lg border bg-white p-6 transition-colors ${flash ? 'border-accent' : 'border-ink-200'}`}>
          <div className="mb-3 flex items-center justify-between">
            <p className="eyebrow">Result</p>
            {task.result && (
              <div className="flex gap-2 text-[11px]">
                <button type="button" onClick={copy} className="rounded-md border border-ink-200 px-2.5 py-1 text-ink-600 hover:bg-ink-50">
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
                <button type="button" onClick={download} className="rounded-md border border-ink-200 px-2.5 py-1 text-ink-600 hover:bg-ink-50">
                  Download .md
                </button>
              </div>
            )}
          </div>
          {task.result ? (
            <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: renderMarkdown(task.result) }} />
          ) : task.status === 'running' ? (
            <p className="text-sm text-amber-600">Rhai is working on this…</p>
          ) : (
            <p className="text-sm text-ink-400">No result yet — run this task from the board.</p>
          )}
        </div>

        {/* Chat rail */}
        <TaskChat task={task} authedFetch={authedFetch} onEdited={onEdited} onChat={c => setTask({ ...task, chat: c })} />
      </div>
    </div>
  );
}

function TaskChat({
  task,
  authedFetch,
  onEdited,
  onChat
}: {
  task: RhaiTask;
  authedFetch: (p: string, i?: RequestInit) => Promise<Response>;
  onEdited: (updated: string) => void;
  onChat: (chat: NonNullable<RhaiTask['chat']>) => void;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chat = task.chat ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.length, sending]);

  const send = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setDraft('');
    setSending(true);
    const now = Date.now();
    onChat([...chat, { role: 'rhea', text: message, at: now }]);
    try {
      const res = await authedFetch(`/api/rhai/tasks/${task.id}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message })
      });
      if (!res.ok) {
        onChat([...chat, { role: 'rhea', text: message, at: now }, { role: 'rhai', text: 'Sorry — something went wrong. Try again.', at: Date.now() }]);
        return;
      }
      const d = (await res.json()) as { reply: string; updatedResult: string | null };
      onChat([...chat, { role: 'rhea', text: message, at: now }, { role: 'rhai', text: d.reply, at: Date.now() }]);
      if (d.updatedResult) onEdited(d.updatedResult);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[70vh] flex-col overflow-hidden rounded-lg border border-ink-200 bg-white lg:sticky lg:top-4">
      <div className="border-b border-ink-100 bg-cream-50 px-4 py-2.5">
        <p className="eyebrow">Chat with Rhai</p>
        <p className="text-[11px] text-ink-500">Ask for edits — “tighten it”, “add a section on X” — and the result updates.</p>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {chat.length === 0 && (
          <p className="px-1 text-[11px] leading-relaxed text-ink-400">
            Nothing yet. Try “make it shorter and punchier”, “add a section on pricing”, or ask a question about the deliverable.
          </p>
        )}
        {chat.map((m, i) => (
          <div key={i} className={m.role === 'rhea' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[12px] leading-relaxed ${
                m.role === 'rhea' ? 'bg-ink-900 text-cream' : 'border border-ink-200 bg-cream-50 text-ink-800'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {sending && <p className="px-1 text-[11px] text-ink-400">Rhai is thinking…</p>}
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
            placeholder="Ask Rhai to edit or explain…"
            className="flex-1 resize-none rounded-md border border-ink-200 px-2.5 py-1.5 text-[12px] leading-relaxed focus:border-ink-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={sending || !draft.trim()}
            className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-600 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: RhaiTask['status'] }) {
  const map = {
    queued: 'bg-ink-100 text-ink-500',
    running: 'bg-amber-100 text-amber-800',
    done: 'bg-emerald-100 text-emerald-800',
    failed: 'bg-rose-100 text-rose-700'
  } as const;
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${map[status]}`}>{status}</span>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl px-6 py-16">{children}</div>;
}
