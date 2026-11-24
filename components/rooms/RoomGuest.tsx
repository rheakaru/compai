'use client';

// The participant's phone in a transcript room (/r/<id>). Enter your name,
// then one big button: tap to talk, tap to stop. While you're on, the screen
// turns green and your words appear as you speak. Rhea can also start/stop
// your turn from her console — this page follows the room and switches your
// mic on/off to match. You see who's in the room, never anyone else's words.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GuestRoomView } from '@/lib/rooms/types';
import { useTurnRecorder } from './useTurnRecorder';

interface Session {
  participantId: string;
  token: string;
  name: string;
}

const storeKey = (id: string) => `rhai.room.${id}`;

function loadSession(id: string): Session | null {
  try {
    const raw = localStorage.getItem(storeKey(id));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
function saveSession(id: string, s: Session | null) {
  try {
    if (s) localStorage.setItem(storeKey(id), JSON.stringify(s));
    else localStorage.removeItem(storeKey(id));
  } catch {
    /* private mode — session lives in memory only */
  }
}

/** Keep the phone awake while in the room, so polling and the mic keep going. */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on) return;
    type Sentinel = { release: () => Promise<void> };
    const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } };
    let lock: Sentinel | null = null;
    const grab = () => {
      if (document.visibilityState === 'visible' && nav.wakeLock) {
        nav.wakeLock.request('screen').then(l => (lock = l)).catch(() => undefined);
      }
    };
    grab();
    document.addEventListener('visibilitychange', grab);
    return () => {
      document.removeEventListener('visibilitychange', grab);
      lock?.release().catch(() => undefined);
    };
  }, [on]);
}

export function RoomGuest({ roomId }: { roomId: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [booted, setBooted] = useState(false);
  const [peek, setPeek] = useState<{ name: string; status: 'open' | 'ended' } | null | 'missing'>(null);
  const [room, setRoom] = useState<GuestRoomView | null>(null);
  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsTap, setNeedsTap] = useState<string | null>(null);

  const rec = useTurnRecorder(session ? { roomId, participantId: session.participantId, token: session.token } : null);
  const handledRef = useRef<string | null>(null);
  const tapStartingRef = useRef(false);

  useWakeLock(!!session && room?.status === 'open');

  // Boot: rejoin from this device if we've been here before; else peek.
  useEffect(() => {
    setSession(loadSession(roomId));
    setBooted(true);
    fetch(`/api/rooms/${roomId}/join`)
      .then(r => (r.ok ? r.json() : null))
      .then(j => setPeek(j ? (j as { name: string; status: 'open' | 'ended' }) : 'missing'))
      .catch(() => setPeek('missing'));
  }, [roomId]);

  const call = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      if (!session) throw new Error('no session');
      return fetch(`/api/rooms/${roomId}/guest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ participantId: session.participantId, token: session.token, action, ...extra })
      });
    },
    [roomId, session]
  );

  // Poll the room.
  useEffect(() => {
    if (!session) return;
    let alive = true;
    let t: number | undefined;
    const tick = async () => {
      try {
        const r = await call('state');
        if (r.status === 403 || r.status === 404) {
          saveSession(roomId, null);
          if (alive) setSession(null);
          return;
        }
        if (r.ok && alive) setRoom(((await r.json()) as { room: GuestRoomView }).room);
      } catch {
        /* network blip — try again */
      }
      if (alive) t = window.setTimeout(tick, document.visibilityState === 'visible' ? 1000 : 3000);
    };
    void tick();
    return () => {
      alive = false;
      if (t) window.clearTimeout(t);
    };
  }, [session, call, roomId]);

  // Follow the room: if my turn was opened (by me or by Rhea) start the mic;
  // if my turn was closed elsewhere, stop and upload.
  const me = session?.participantId;
  const current = room?.current ?? null;
  useEffect(() => {
    if (!me || tapStartingRef.current) return;
    if (current && current.participantId === me) {
      if (rec.state === 'idle' && handledRef.current !== current.turnId) {
        handledRef.current = current.turnId;
        rec.start(current.turnId).catch(() => setNeedsTap(current.turnId));
      }
    } else if ((rec.state === 'recording' || rec.state === 'starting') && rec.turnId && current?.turnId !== rec.turnId) {
      void rec.stop();
    }
    if (needsTap && current?.turnId !== needsTap) {
      setNeedsTap(null);
      rec.setError(null);
    }
  }, [me, current, rec, needsTap]);

  const join = async () => {
    const clean = name.trim();
    if (!clean) return;
    setJoining(true);
    setJoinError(null);
    // Ask for the mic now, inside the tap, so it's ready when it's their turn.
    rec
      .acquire()
      .then(() => rec.release())
      .catch(() => undefined);
    try {
      const r = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: clean })
      });
      if (!r.ok) {
        setJoinError((await r.text()) || 'Could not join.');
        return;
      }
      const j = (await r.json()) as { participantId: string; token: string; room: GuestRoomView };
      const s = { participantId: j.participantId, token: j.token, name: clean };
      saveSession(roomId, s);
      setRoom(j.room);
      setSession(s);
    } catch {
      setJoinError('Could not reach the room. Check your connection.');
    } finally {
      setJoining(false);
    }
  };

  const mine = !!current && current.participantId === me;
  const recording = rec.state === 'recording' || rec.state === 'starting';
  const active = mine || recording;

  const onBigButton = async () => {
    if (busy) return;
    if (needsTap && mine) {
      setNeedsTap(null);
      rec.start(needsTap).catch(() => setNeedsTap(needsTap));
      return;
    }
    setBusy(true);
    try {
      if (active) {
        const tId = rec.turnId ?? current?.turnId;
        if (tId) await call('stop', { turnId: tId }).catch(() => undefined);
        setRoom(r => (r ? { ...r, current: null } : r));
        await rec.stop();
      } else {
        tapStartingRef.current = true;
        const mic = rec.acquire(); // inside the tap, for iOS
        const r = await call('start');
        if (!r.ok) {
          rec.release();
          rec.setError(r.status === 409 ? 'This room has ended.' : 'Could not start. Try again.');
          return;
        }
        const { turnId } = (await r.json()) as { turnId: string };
        handledRef.current = turnId;
        setRoom(rm => (rm ? { ...rm, current: { turnId, participantId: me!, startedAt: Date.now() } } : rm));
        await mic.catch(() => undefined);
        await rec.start(turnId).catch(async () => {
          await call('stop', { turnId }).catch(() => undefined);
        });
      }
    } finally {
      tapStartingRef.current = false;
      setBusy(false);
    }
  };

  const leave = () => {
    if (recording) return;
    saveSession(roomId, null);
    setSession(null);
    setRoom(null);
  };

  // ---------------------------------------------------------------- screens

  if (!booted || (!session && peek === null)) {
    return <Shell><p className="text-sm text-ink-400">Opening the room…</p></Shell>;
  }

  if (!session) {
    if (peek === 'missing') {
      return (
        <Shell>
          <h1 className="font-display text-3xl text-ink-900">Room not found</h1>
          <p className="mt-3 text-sm text-ink-500">Check the link or scan the QR code again.</p>
        </Shell>
      );
    }
    if (peek && peek.status === 'ended') {
      return (
        <Shell>
          <p className="text-[11px] uppercase tracking-eyebrow text-ink-400">Room</p>
          <h1 className="mt-2 font-display text-3xl text-ink-900">{peek.name}</h1>
          <p className="mt-4 text-sm text-ink-500">This room has ended. Thanks for being here.</p>
        </Shell>
      );
    }
    return (
      <Shell>
        <p className="text-[11px] uppercase tracking-eyebrow text-ink-400">You&apos;re joining</p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink-900">{peek?.name ?? ''}</h1>
        <form
          className="mt-8 w-full"
          onSubmit={e => {
            e.preventDefault();
            void join();
          }}
        >
          <label htmlFor="room-name" className="block text-left text-sm font-medium text-ink-700">
            Your name
          </label>
          <input
            id="room-name"
            autoFocus
            autoComplete="name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="So everyone knows who said what"
            maxLength={60}
            className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-4 py-3.5 text-lg text-ink-900 outline-none focus:border-ink-500"
          />
          {joinError && <p className="mt-2 text-left text-sm text-accent">{joinError}</p>}
          <button
            type="submit"
            disabled={!name.trim() || joining}
            className="mt-4 w-full rounded-xl bg-ink-900 px-4 py-3.5 text-base font-medium text-cream disabled:opacity-40"
          >
            {joining ? 'Entering…' : 'Enter the room'}
          </button>
          <p className="mt-4 text-xs leading-relaxed text-ink-400">
            Your mic is only on while it&apos;s your turn — the screen turns green when it is. What you say is
            transcribed for the meeting host.
          </p>
        </form>
      </Shell>
    );
  }

  if (room?.status === 'ended' && !recording && rec.state !== 'uploading') {
    return (
      <Shell>
        <p className="text-[11px] uppercase tracking-eyebrow text-ink-400">Room</p>
        <h1 className="mt-2 font-display text-3xl text-ink-900">{room.name}</h1>
        <p className="mt-4 text-sm text-ink-500">This room has ended. Thanks, {session.name}.</p>
      </Shell>
    );
  }

  const speaker = current ? room?.participants.find(p => p.id === current.participantId) : null;
  const others = (room?.participants ?? []).filter(p => p.id !== me);
  const label =
    rec.state === 'uploading'
      ? 'Saving…'
      : needsTap && mine
        ? 'Tap to start your mic'
        : active
          ? 'Tap to stop'
          : 'Tap to talk';

  return (
    <div
      className={`fixed inset-0 flex flex-col transition-colors duration-300 ${
        active ? 'bg-emerald-600 text-white' : 'bg-cream text-ink-900'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <header className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className={`text-[11px] uppercase tracking-eyebrow ${active ? 'text-emerald-100' : 'text-ink-400'}`}>
            {room?.name ?? ''}
          </p>
          <p className="mt-1 truncate font-display text-xl">{session.name}</p>
        </div>
        {!active && rec.state !== 'uploading' && (
          <button
            type="button"
            onClick={leave}
            className={`shrink-0 text-xs underline-offset-2 hover:underline ${active ? 'text-emerald-100' : 'text-ink-400'}`}
          >
            Not you?
          </button>
        )}
      </header>

      <div className="px-5 pt-4">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {others.length === 0 ? (
            <span className={`text-xs ${active ? 'text-emerald-100' : 'text-ink-400'}`}>Waiting for others to join…</span>
          ) : (
            others.map(p => {
              const talking = current?.participantId === p.id;
              return (
                <span
                  key={p.id}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
                    talking
                      ? 'bg-emerald-600 text-white'
                      : active
                        ? 'bg-white/15 text-white'
                        : 'border border-ink-200 bg-white/70 text-ink-700'
                  }`}
                >
                  {talking && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
                  {p.name}
                </span>
              );
            })
          )}
        </div>
      </div>

      <main className="flex flex-1 flex-col items-center justify-center px-6">
        {!active && speaker && speaker.id !== me && (
          <p className="mb-6 text-sm text-ink-500">
            <span className="font-medium text-ink-800">{speaker.name}</span> is talking
          </p>
        )}
        <button
          type="button"
          onClick={() => void onBigButton()}
          disabled={busy || rec.state === 'uploading'}
          aria-pressed={active}
          className={`relative flex h-56 w-56 items-center justify-center rounded-full text-lg font-medium shadow-lg transition-transform active:scale-95 disabled:opacity-80 sm:h-64 sm:w-64 ${
            active ? 'bg-white text-emerald-700' : 'bg-ink-900 text-cream'
          }`}
        >
          {active && (
            <span
              aria-hidden
              className="absolute inset-0 rounded-full border-4 border-white/70"
              style={{ transform: `scale(${1.04 + rec.level * 0.25})`, transition: 'transform 80ms linear' }}
            />
          )}
          <span className="flex flex-col items-center gap-2">
            {active ? (
              <span className="h-7 w-7 rounded-md bg-emerald-600" aria-hidden />
            ) : (
              <MicIcon />
            )}
            {label}
          </span>
        </button>
        {rec.error && (
          <p className={`mt-5 max-w-xs text-center text-sm ${active ? 'text-white' : 'text-accent'}`}>{rec.error}</p>
        )}
        {mine && current?.participantId === me && !recording && !needsTap && rec.state === 'idle' && (
          <p className="mt-4 text-sm">It&apos;s your turn — starting your mic…</p>
        )}
      </main>

      <section className="max-h-[32vh] min-h-[22vh] overflow-y-auto px-6 pb-6">
        {(recording || rec.state === 'uploading' || rec.live) && (
          <>
            <p className={`text-[11px] uppercase tracking-eyebrow ${active ? 'text-emerald-100' : 'text-ink-400'}`}>
              {active ? 'Listening' : rec.state === 'uploading' ? 'Saving your words' : 'You said'}
            </p>
            <p className={`mt-2 text-lg leading-relaxed ${active ? 'text-white' : 'text-ink-700'}`}>
              {rec.live || (active ? <span className="opacity-70">Start speaking — your words will appear here.</span> : '')}
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center text-center">{children}</div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
