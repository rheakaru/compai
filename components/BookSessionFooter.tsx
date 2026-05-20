/**
 * Quiet bottom-of-page CTA for the session offer. Deliberately understated
 * — not a sales card. The page's job is the diagnosis; the offer sits where
 * "next steps" would in any well-written document.
 */
export function BookSessionFooter() {
  return (
    <footer className="border-t border-ink-200 bg-ink-50/40">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-[11px] uppercase tracking-wider text-ink-500">Next, if you want</p>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-800">
          One day, on your machine, on your real data. One working build by 5pm — not a deck.
          Rhea Karuturi runs the session; that&apos;s the part that doesn&apos;t outsource.
        </p>
        <a
          href="https://rheakaru.github.io/sessions.html"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium hover:opacity-80"
          style={{ color: 'var(--brand, #c64a1f)' }}
        >
          Book a session →
        </a>
      </div>
    </footer>
  );
}
