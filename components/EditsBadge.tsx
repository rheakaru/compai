'use client';

import { Lock } from 'lucide-react';

export function EditsBadge({
  editsUsed,
  maxEdits,
  locked
}: {
  editsUsed: number;
  maxEdits: number;
  locked: boolean;
}) {
  if (locked) {
    return (
      <a
        href="https://rheakaru.github.io/sessions.html"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-md bg-ink-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-900"
        title="You've used all your free edits. Book a session to keep iterating."
      >
        <Lock className="h-3 w-3" />
        Locked — book a session
      </a>
    );
  }

  const remaining = Math.max(0, maxEdits - editsUsed);
  const tone =
    remaining === 0
      ? 'bg-amber-100 text-amber-900 border-amber-200'
      : remaining === 1
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-white text-ink-600 border-ink-200';

  return (
    <div
      className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium ${tone}`}
      title={`Each save / correction / invite counts as one edit. After ${maxEdits} edits, the page locks and the only way forward is booking a session.`}
    >
      {editsUsed} / {maxEdits} edits
    </div>
  );
}
