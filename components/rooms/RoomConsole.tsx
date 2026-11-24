'use client';

// /rooms/<id> — Rhea's console for one transcript room. QR + link to share,
// everyone in the room (tap a person to start/stop their turn for them), the
// transcript building live, then export or file it to the Rhai client.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { HostRoomView, RoomTurn } from '@/lib/rooms/types';
import { roomDateLabel, transcriptMarkdown, turnText } from '@/lib/rooms/types';
import { useAuth } from '../AuthProvider';
import { useAuthedFetch } from '../useAuthedFetch';
import { LeadSelect, roomUrl, useLeadOptions, useQr } from './shared';

function clock(ms: number) {
  return new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'room';
}

function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function RoomConsole({ roomId }: { roomId: string }) {
  const { user, signIn, loading } = useAuth();
  const authedFetch = useAuthedFetch();
  const [room, setRoom] = useState<HostRoomView | null>(null);
  const [turns, setTurns] = useState<RoomTurn[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'denied' | 'missing'>('loading');
  const [present, setPresent] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [filing, setFiling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const revRef = useRef(-1);
  const leads = useLeadOptions(status === 'ok');

  const url = roomUrl(roomId);
  const qr = useQr(url, 640);

  const poll = useCallback(async () => {
    const r = await authedFetch(`/api/rooms/${roomId}`).catch(() => null);
    if (!r) return;
    if (r.status === 401 || r.status === 403) return setStatus('denied');
    if (r.status === 404) return setStatus('missing');
    if (!r.ok) return;
    const { room: next } = (await r.json()) as { room: HostRoomView };
    setRoom(next);
    setStatus('ok');
    if (next.turnsRev !== revRef.current) {
      const t = await authedFetch(`/api/rooms/${roomId}?turns=1`).catch(() => null);
      if (t?.ok) {
        const j = (await t.json()) as { room: HostRoomView; turns: RoomTurn[] };
        revRef.current = j.room.turnsRev;
        setTurns(j.turns);
        setRoom(j.room);
      }
    }
  }, [authedFetch, roomId]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    let t: number | undefined;
    const tick = async () => {
      await poll();
      if (alive) t = window.setTimeout(tick, document.visibilityState === 'visible' ? 1000 : 4000);
    };
    void tick();
    return () => {
      alive = false;
      if (t) window.clearTimeout(t);
    };
  }, [user, poll]);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(n => (n === msg ? null : n)), 3500);
  };

  const patch = async (body: Record<string, unknown>) => {
    const r = await authedFetch(`/api/rooms/${roomId}`, { method: 'PATCH', body: JSON.stringify(body) });
    if (r.ok) setRoom(((await r.json()) as { room: HostRoomView }).room);
    else flash(await r.text());
    return r.ok;
  };

  const toggleTurn = async (participantId: string) => {
    if (!room) return;
    setPending(participantId);
    const cur = room.current;
    const body =
      cur && cur.participantId === participantId
        ? { action: 'stop', turnId: cur.turnId }
        : { action: 'start', participantId };
    const r = await authedFetch(`/api/rooms/${roomId}/host`, { method: 'POST', body: JSON.stringify(body) });
    if (!r.ok) flash(await r.text());
    await poll();
    setPending(null);
  };

  const markdown = room ? transcriptMarkdown(room, room.participants, turns) : '';
  const plain = markdown.replace(/\*\*/g, '').replace(/^# /, '');

  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(c => (c === what ? null : c)), 2000);
    } catch {
      flash('Could not copy — your browser blocked the clipboard.');
    }
  };

  const fileToClient = async () => {
    setFiling(true);
    const r = await authedFetch(`/api/rooms/${roomId}/file`, { method: 'POST' });
    setFiling(false);
    if (r.ok) {
      setRoom(((await r.json()) as { room: HostRoomView }).room);
      flash('Transcript saved to the client’s notes.');
    } else flash(await r.text());
  };

  const endRoom = async () => {
    if (!room) return;
    if (!window.confirm('End the room? People can no longer join or talk.')) return;
    if (await patch({ status: 'ended' })) {
      // Give the last speaker's phone a moment to upload, then file.
      if (room.leadId) {
        window.setTimeout(() => void fileToClient(), 6000);
        flash('Room ended — filing the transcript to the client in a few seconds.');
      }
    }
  };

  const editTurn = async (t: RoomTurn) => {
    const next = window.prompt(`Edit what ${t.name} said`, turnText(t));
    if (next === null) return;
    await authedFetch(`/api/rooms/${roomId}/turns/${t.id}`, { method: 'PATCH', body: JSON.stringify({ text: next }) });
    await poll();
  };
  const removeTurn = async (t: RoomTurn) => {
    if (!window.confirm(`Remove this turn by ${t.name}?`)) return;
    await authedFetch(`/api/rooms/${roomId}/turns/${t.id}`, { method: 'DELETE' });
    await poll();
  };

  // ---------------------------------------------------------------- screens

  if (loading) return <div className="p-10 text-sm text-ink-400">…</div>;
  if (!user || status === 'denied') {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-display text-3xl text-ink-900">Room console</h1>
        <p className="mt-3 text-sm text-ink-500">Only the room&apos;s host can see this. Sign in with your operator account.</p>
        <button
          type="button"
          onClick={() => signIn().then(() => setStatus('loading')).catch(() => undefined)}
          className="mt-6 rounded-md bg-ink-900 px-4 py-2 text-sm text-cream"
        >
          Sign in
        </button>
      </div>
    );
  }
  if (status === 'missing') {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-display text-3xl text-ink-900">Room not found</h1>
        <Link href="/rooms" className="mt-4 inline-block text-sm text-accent">← All rooms</Link>
      </div>
    );
  }
  if (!room) return <div className="p-10 text-sm text-ink-400">Loading room…</div>;

  const open = room.status === 'open';
  const cur = room.current;
  const speaker = cur ? room.participants.find(p => p.id === cur.participantId) : null;
  const doneTurns = turns.filter(t => t.id !== cur?.turnId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/rooms" className="text-xs text-ink-400 hover:text-ink-700">← All rooms</Link>
          <h1
            className="mt-1 cursor-text font-display text-3xl text-ink-900"
            title="Click to rename"
            onClick={() => {
              const n = window.prompt('Room name', room.name);
              if (n && n.trim()) void patch({ name: n.trim() });
            }}
          >
            {room.name}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-xs text-ink-400">
            <span className={`h-2 w-2 rounded-full ${open ? 'bg-emerald-500' : 'bg-ink-200'}`} />
            {open ? 'Live' : 'Ended'} · {roomDateLabel(room.createdAt)} · {room.participants.length}{' '}
            {room.participants.length === 1 ? 'person' : 'people'} · {turns.length} {turns.length === 1 ? 'turn' : 'turns'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {open ? (
            <>
              <button type="button" onClick={() => setPresent(true)} className="rounded-lg bg-ink-900 px-3 py-2 text-sm font-medium text-cream">
                Show QR full screen
              </button>
              <button type="button" onClick={() => void endRoom()} className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-800 hover:bg-cream-50">
                End room
              </button>
            </>
          ) : (
            <button type="button" onClick={() => void patch({ status: 'open' })} className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-800 hover:bg-cream-50">
              Reopen room
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="mt-4 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm text-ink-700">{notice}</div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr]">
        {/* ---------------- left: share + people ---------------- */}
        <aside className="space-y-6">
          <section className="rounded-2xl border border-ink-200/80 bg-white/80 p-4">
            {qr ? (
              <img src={qr} alt={`QR code to join ${room.name}`} className="mx-auto aspect-square w-full max-w-[14rem] rounded-lg" />
            ) : (
              <div className="mx-auto aspect-square w-full max-w-[14rem] rounded-lg bg-cream-100" />
            )}
            <div className="mt-3 flex items-center gap-2">
              <input readOnly value={url} className="min-w-0 flex-1 truncate rounded-md border border-ink-200 bg-cream-50 px-2 py-1.5 font-mono text-[11px] text-ink-600" onFocus={e => e.target.select()} />
              <button type="button" onClick={() => void copy('link', url)} className="shrink-0 rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink-700 hover:bg-cream-50">
                {copied === 'link' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-ink-200/80 bg-white/80 p-4">
            <h2 className="text-xs font-medium uppercase tracking-eyebrow text-ink-400">In the room</h2>
            {room.participants.length === 0 ? (
              <p className="mt-3 text-sm text-ink-400">Nobody yet — share the QR code.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {room.participants.map(p => {
                  const talking = cur?.participantId === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={!open || pending === p.id}
                        onClick={() => void toggleTurn(p.id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-60 ${
                          talking ? 'bg-emerald-600 text-white' : 'bg-cream-50 text-ink-800 hover:bg-cream-100'
                        }`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${talking ? 'bg-white text-emerald-700' : 'bg-ink-900 text-cream'}`}>
                          {p.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        {open && (
                          <span className={`shrink-0 text-xs ${talking ? 'text-emerald-50' : 'text-ink-400'}`}>
                            {pending === p.id ? '…' : talking ? 'Stop' : 'Start'}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {open && room.participants.length > 0 && (
              <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
                Tap someone to switch their mic on or off for them — it records on their phone.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-ink-200/80 bg-white/80 p-4">
            <h2 className="text-xs font-medium uppercase tracking-eyebrow text-ink-400">Rhai client</h2>
            <div className="mt-3">
              <LeadSelect value={room.leadId ?? ''} options={leads} onChange={id => void patch({ leadId: id || null })} />
            </div>
            {room.leadId && (
              <>
                <button
                  type="button"
                  disabled={filing || turns.length === 0}
                  onClick={() => void fileToClient()}
                  className="mt-3 w-full rounded-lg bg-ink-900 px-3 py-2 text-sm font-medium text-cream disabled:opacity-40"
                >
                  {filing ? 'Saving…' : room.noteSessionId ? 'Update client notes' : 'Save transcript to client'}
                </button>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
                  {room.filedAt
                    ? `Saved to ${room.leadLabel}'s notes ${roomDateLabel(room.filedAt)}, ${clock(room.filedAt)}. Saving again updates the same note.`
                    : `Saves as a note session on ${room.leadLabel}. It's also saved automatically when you end the room.`}
                </p>
              </>
            )}
          </section>
        </aside>

        {/* ---------------- right: transcript ---------------- */}
        <section className="min-w-0 rounded-2xl border border-ink-200/80 bg-white/80">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200/70 px-5 py-3">
            <h2 className="text-sm font-medium text-ink-900">Transcript</h2>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" disabled={!turns.length} onClick={() => void copy('md', markdown)} className="rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink-700 hover:bg-cream-50 disabled:opacity-40">
                {copied === 'md' ? 'Copied' : 'Copy'}
              </button>
              <button type="button" disabled={!turns.length} onClick={() => download(`${slug(room.name)}.md`, markdown, 'text/markdown')} className="rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink-700 hover:bg-cream-50 disabled:opacity-40">
                Download .md
              </button>
              <button type="button" disabled={!turns.length} onClick={() => download(`${slug(room.name)}.txt`, plain, 'text/plain')} className="rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink-700 hover:bg-cream-50 disabled:opacity-40">
                Download .txt
              </button>
            </div>
          </div>

          <ol className="space-y-5 px-5 py-5">
            {doneTurns.length === 0 && !cur && (
              <li className="text-sm text-ink-400">
                Nothing yet. When someone taps to talk, their words show up here.
              </li>
            )}
            {doneTurns.map(t => {
              const text = turnText(t);
              return (
                <li key={t.id} className="group">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-ink-900">{t.name}</span>
                    <span className="text-[11px] text-ink-400">{clock(t.startedAt)}</span>
                    {t.status !== 'done' && <span className="text-[11px] text-amber-600">transcribing…</span>}
                    {t.status === 'done' && !t.text && t.liveText && <span className="text-[11px] text-ink-400">live draft</span>}
                    <span className="ml-auto hidden gap-2 group-hover:flex">
                      <button type="button" onClick={() => void editTurn(t)} className="text-[11px] text-ink-400 hover:text-ink-800">Edit</button>
                      <button type="button" onClick={() => void removeTurn(t)} className="text-[11px] text-ink-400 hover:text-accent">Remove</button>
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-700">
                    {text || <span className="text-ink-300">(no words captured)</span>}
                  </p>
                </li>
              );
            })}
            {cur && (
              <li className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="flex items-baseline gap-2">
                  <span className="h-2 w-2 animate-pulse self-center rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium text-emerald-900">{speaker?.name ?? 'Someone'}</span>
                  <span className="text-[11px] text-emerald-700">talking · {clock(cur.startedAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-emerald-950">
                  {cur.live || <span className="text-emerald-700/70">Listening…</span>}
                </p>
              </li>
            )}
          </ol>
        </section>
      </div>

      {present && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-cream px-6" onClick={() => setPresent(false)}>
          <p className="text-xs uppercase tracking-eyebrow text-ink-400">Scan to join</p>
          <h2 className="mt-2 text-center font-display text-4xl text-ink-900 sm:text-5xl">{room.name}</h2>
          {qr && <img src={qr} alt="" className="mt-8 aspect-square w-[min(70vh,80vw)] rounded-2xl bg-white p-3 shadow-sm" />}
          <p className="mt-6 font-mono text-sm text-ink-500">{url.replace(/^https?:\/\//, '')}</p>
          <p className="mt-2 text-sm text-ink-400">
            {room.participants.length} {room.participants.length === 1 ? 'person' : 'people'} in · tap anywhere to close
          </p>
        </div>
      )}
    </div>
  );
}
