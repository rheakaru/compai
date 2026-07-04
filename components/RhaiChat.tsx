'use client';

// The standing conversation with Rhai — floating button on every tab, slide-
// over panel, messages persisted in Firestore forever. Text + voice input.
// Rhai routes intel to person profiles and files suggestions via tools;
// every tool action is shown in the thread for transparency.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useAuthedFetch } from './useAuthedFetch';
import { useVoice } from './useVoice';
import type { RhaiChatMessage } from '@/lib/rhai/types';

export function RhaiChat() {
  const { user } = useAuth();
  const authedFetch = useAuthedFetch();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<RhaiChatMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const voice = useVoice(t => setDraft(d => (d ? d + ' ' + t : t)));

  const load = useCallback(async () => {
    const res = await authedFetch('/api/rhai/chat');
    if (res.ok) setMessages(((await res.json()) as { messages: RhaiChatMessage[] }).messages);
  }, [authedFetch]);

  useEffect(() => {
    if (open && user && messages === null) load().catch(() => undefined);
  }, [open, user, messages, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (voice.listening) voice.toggle();
    setDraft('');
    setSending(true);
    const optimistic: RhaiChatMessage = { id: `tmp-${Date.now()}`, role: 'user', text, at: Date.now() };
    setMessages(prev => [...(prev ?? []), optimistic]);
    try {
      const res = await authedFetch('/api/rhai/chat', { method: 'POST', body: JSON.stringify({ text }) });
      if (res.ok) {
        const { message } = (await res.json()) as { message: RhaiChatMessage };
        setMessages(prev => [...(prev ?? []), message]);
        window.dispatchEvent(new Event('rhai:peopleChanged'));
      } else {
        const errText = await res.text();
        setMessages(prev => [
          ...(prev ?? []),
          { id: `err-${Date.now()}`, role: 'rhai', text: `(couldn't reply: ${errText})`, at: Date.now() }
        ]);
      }
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-cream shadow-lg transition-transform hover:scale-105"
        title="Chat with Rhai"
      >
        {open ? '✕' : 'R·'}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex h-[70vh] w-[400px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-xl border border-ink-200 bg-cream-50 shadow-2xl">
          <div className="border-b border-ink-200 bg-white px-4 py-3">
            <p className="eyebrow">Rhai · standing chat</p>
            <p className="text-[11px] text-ink-400">
              Everything here persists. Intel routes to profiles; actions land on Today.
            </p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages === null ? (
              <p className="text-xs text-ink-400">Loading…</p>
            ) : messages.length === 0 ? (
              <p className="text-xs text-ink-400">
                Tell me anything — “met Ankit at YPO, runs a cold-chain company, wants a demo” and I&apos;ll
                file it where it belongs.
              </p>
            ) : (
              messages.map(m => (
                <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                      m.role === 'user' ? 'bg-ink-900 text-cream' : 'border border-ink-200 bg-white text-ink-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    {m.toolNotes && m.toolNotes.length > 0 && (
                      <ul className="mt-1.5 border-t border-ink-100 pt-1.5">
                        {m.toolNotes.map((n, i) => (
                          <li key={i} className="text-[10px] text-emerald-700">
                            ✓ {n}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))
            )}
            {sending && <p className="text-[11px] text-ink-400">Rhai is thinking…</p>}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-ink-200 bg-white p-3">
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
                placeholder="Type or dictate…"
                className="flex-1 resize-none rounded-md border border-ink-200 px-2.5 py-2 text-xs leading-relaxed focus:border-ink-300 focus:outline-none"
              />
              {voice.supported && (
                <button
                  type="button"
                  onClick={voice.toggle}
                  className={`rounded-full border px-2.5 py-2 text-sm ${
                    voice.listening
                      ? 'border-rose-300 bg-rose-50 text-rose-700'
                      : 'border-ink-200 text-ink-500 hover:bg-ink-50'
                  }`}
                  title="Voice input"
                >
                  {voice.listening ? '●' : '🎙'}
                </button>
              )}
              <button
                type="button"
                onClick={send}
                disabled={sending || !draft.trim()}
                className="rounded-md bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-600 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
