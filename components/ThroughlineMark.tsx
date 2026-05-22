'use client';

/**
 * Small brand mark for the top-left of every page. Subtle by design — the
 * prospect's own brand should dominate the page (BrandHeader); this is a
 * quiet "you're using Throughline" anchor.
 */
export function ThroughlineMark() {
  return (
    <a
      href="/"
      className="fixed left-4 top-3 z-40 flex items-center gap-2 rounded-md bg-white/80 px-2.5 py-1.5 text-sm backdrop-blur hover:bg-white"
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: 'var(--brand, #c64a1f)' }}
      />
      <span className="font-semibold tracking-tight text-ink-900">Throughline</span>
    </a>
  );
}
