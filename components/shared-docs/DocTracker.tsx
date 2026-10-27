'use client';

import { useEffect, useRef } from 'react';

// Reading-progress tracker for a shared doc. Logs one view on mount, then
// reports the furthest scroll depth, the furthest [data-track] section that
// came into view, and active reading time (tab visible + some activity in the
// last minute). Sends every 15s while things change, and on tab hide / exit.

export function DocTracker({ slug, children }: { slug: string; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const sections = Array.from(el.querySelectorAll<HTMLElement>('[data-track]'));
    const state = { viewId: '', depth: 0, sectionIndex: 0, section: sections[0]?.dataset.track ?? '', activeSeconds: 0 };
    let lastSent = '';
    let lastActivity = Date.now();
    let stopped = false;

    const send = (useBeacon = false) => {
      if (!state.viewId) return;
      const body = JSON.stringify(state);
      if (body === lastSent) return;
      lastSent = body;
      const url = `/api/shared/${slug}/beacon`;
      if (useBeacon && navigator.sendBeacon) navigator.sendBeacon(url, body);
      else void fetch(url, { method: 'POST', body, keepalive: true }).catch(() => undefined);
    };

    const measure = () => {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const pct = doc.scrollHeight <= window.innerHeight ? 100 : Math.round((window.scrollY / max) * 100);
      state.depth = Math.max(state.depth, Math.min(100, pct));
      // A section counts as reached once its top passes 70% of the viewport.
      sections.forEach((s, i) => {
        if (s.getBoundingClientRect().top < window.innerHeight * 0.7 && i >= state.sectionIndex) {
          state.sectionIndex = i;
          state.section = s.dataset.track ?? '';
        }
      });
    };

    const onActivity = () => {
      lastActivity = Date.now();
      measure();
    };

    void fetch(`/api/shared/${slug}/view`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ totalSections: sections.length, referrer: document.referrer })
    })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { viewId?: string } | null) => {
        if (stopped || !d?.viewId) return;
        state.viewId = d.viewId;
        measure();
        send();
      })
      .catch(() => undefined);

    const tick = window.setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastActivity < 60_000) state.activeSeconds += 5;
    }, 5000);
    const flush = window.setInterval(() => send(), 15_000);
    const onHide = () => {
      if (document.visibilityState === 'hidden') send(true);
    };
    const onExit = () => send(true);

    window.addEventListener('scroll', onActivity, { passive: true });
    window.addEventListener('pointermove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('touchstart', onActivity, { passive: true });
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onExit);

    return () => {
      stopped = true;
      send(true);
      window.clearInterval(tick);
      window.clearInterval(flush);
      window.removeEventListener('scroll', onActivity);
      window.removeEventListener('pointermove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('touchstart', onActivity);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onExit);
    };
  }, [slug]);

  return <div ref={root}>{children}</div>;
}
