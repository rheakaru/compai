'use client';

// The interactive voice testimonials on heyrhai.com. Renders only the ones
// Rhea has approved. Each is a card you play — animated bars while it speaks,
// the transcript as a quote underneath. Renders nothing if there are none, so
// it can sit on the homepage unconditionally.

import { useEffect, useRef, useState } from 'react';
import type { PublicTestimonial } from '@/lib/rhai/testimonials';

export function VoiceWall() {
  const [items, setItems] = useState<PublicTestimonial[] | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch('/api/testimonial')
      .then(r => (r.ok ? r.json() : { testimonials: [] }))
      .then((d: { testimonials: PublicTestimonial[] }) => setItems(d.testimonials))
      .catch(() => setItems([]));
  }, []);

  const toggle = (t: PublicTestimonial) => {
    const el = audioRef.current;
    if (!el) return;
    if (playing === t.id) {
      el.pause();
      setPlaying(null);
      return;
    }
    setFailed(null);
    // iOS Safari will not start a new source unless the element is reloaded,
    // and it only honours play() inside the user gesture that triggered it —
    // so pause, swap, load and play synchronously here. Anything awaited
    // before play() loses the gesture and the promise rejects.
    el.pause();
    el.src = t.audioUrl;
    el.load();
    const started = el.play();
    // Older WebKit returns undefined rather than a promise.
    if (started && typeof started.then === 'function') {
      started.then(() => setPlaying(t.id)).catch(() => {
        setPlaying(null);
        setFailed(t.id);
      });
    } else {
      setPlaying(t.id);
    }
  };

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnd = () => setPlaying(null);
    // A silent pause (headphones out, a call, the OS interrupting) would
    // otherwise leave the card stuck showing as playing.
    const onPause = () => setPlaying(p => (el.ended || el.paused ? null : p));
    const onError = () => setPlaying(null);
    el.addEventListener('ended', onEnd);
    el.addEventListener('pause', onPause);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('error', onError);
    };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="border-b border-ink-200/60 bg-cream-100">
      <div className="relative mx-auto max-w-5xl px-6 py-20">
        <p className="eyebrow">In their own voice</p>
        <h2 className="mt-3 max-w-3xl font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
          What people say after a session.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-700">
          Real voices from the room — tap to listen.
        </p>

        {/* Not `hidden`: a display:none media element is not reliably playable
            on iOS, so it stays in the render tree but out of sight. */}
        <audio
          ref={audioRef}
          preload="none"
          playsInline
          className="pointer-events-none absolute h-px w-px opacity-0"
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {items.map(t => {
            const on = playing === t.id;
            return (
              <div
                key={t.id}
                className={`rounded-xl border bg-white p-5 transition-colors ${on ? 'border-accent' : 'border-ink-200'}`}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggle(t)}
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg transition ${on ? 'bg-accent text-white' : 'bg-accent-soft text-accent hover:bg-accent hover:text-white'}`}
                    aria-label={on ? 'Pause' : 'Play'}
                  >
                    {on ? '❚❚' : '▶'}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{t.name}</p>
                    {t.role && <p className="truncate text-[11px] text-ink-500">{t.role}</p>}
                  </div>
                  <Bars active={on} />
                </div>
                {failed === t.id && (
                  <p className="mt-3 text-[12px] text-accent">
                    Couldn&apos;t play that one here —{' '}
                    <a href={t.audioUrl} target="_blank" rel="noreferrer" className="underline">
                      open the audio
                    </a>
                    .
                  </p>
                )}
                {t.transcript && (
                  <p className="mt-3 text-[13px] italic leading-relaxed text-ink-600">&ldquo;{t.transcript}&rdquo;</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Bars({ active }: { active: boolean }) {
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden>
      {[0, 1, 2, 3, 4].map(i => (
        <span
          key={i}
          className={`w-[3px] rounded-full ${active ? 'bg-accent' : 'bg-ink-200'}`}
          style={
            active
              ? { height: '100%', animation: `vw-bar 0.9s ease-in-out ${i * 0.12}s infinite alternate` }
              : { height: '30%' }
          }
        />
      ))}
      <style>{`@keyframes vw-bar { from { transform: scaleY(0.25); } to { transform: scaleY(1); } }`}</style>
    </div>
  );
}
