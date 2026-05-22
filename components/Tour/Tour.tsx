'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Lightweight guided-tour overlay. Custom rather than react-joyride so we
 * control the styling (brand colours, plain typography) and keep the
 * bundle small.
 *
 * Each step targets a DOM element by CSS selector. The overlay dims the
 * rest of the page; a brand-coloured rectangle marks the target; a
 * tooltip card sits near the target with prev/next/skip controls.
 *
 * If the selector doesn't resolve on the current page, the step renders
 * as a centred modal with no spotlight (useful for the welcome / closing
 * panels).
 */
export interface TourStep {
  /** CSS selector for the target element. Empty string = centred modal. */
  selector: string;
  title: string;
  body: React.ReactNode;
  /** Tooltip placement preference; defaults to 'bottom'. Falls back if
   *  there isn't room. */
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

const PAD = 8;             // padding around the highlighted rect
const GAP = 12;            // gap between rect and tooltip card
const CARD_W = 360;        // approximate tooltip width
const CARD_H_MIN = 180;    // approximate tooltip min height

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function Tour({
  steps,
  open,
  onClose
}: {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Reset to first step whenever the tour opens.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  // Measure the target rectangle for the current step, scrolling it into
  // view first. Re-measure on resize / scroll.
  useLayoutEffect(() => {
    if (!open) return;
    const step = steps[index];
    if (!step) return;

    const measure = () => {
      if (!step.selector) {
        setRect(null);
        return;
      }
      const el = document.querySelector<HTMLElement>(step.selector);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height
      });
    };

    if (step.selector) {
      const el = document.querySelector<HTMLElement>(step.selector);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Wait for scroll to settle, then measure.
    const t1 = setTimeout(measure, 60);
    const t2 = setTimeout(measure, 400);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [open, index, steps]);

  // Keyboard nav: arrows + Esc.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        setIndex(i => Math.min(steps.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        setIndex(i => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, steps.length, onClose]);

  if (!open) return null;
  const step = steps[index];
  if (!step) return null;

  const totalSteps = steps.length;
  const isFirst = index === 0;
  const isLast = index === totalSteps - 1;

  // Compute tooltip position.
  let cardStyle: React.CSSProperties;
  if (!rect) {
    // Centred modal (no target).
    cardStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: Math.min(CARD_W, window.innerWidth - 32)
    };
  } else {
    const placement = step.placement ?? 'bottom';
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    let top = 0;
    let left = 0;

    // Try preferred placement first; fall back if off-screen.
    const placements: Array<typeof placement> = [
      placement,
      ...(['bottom', 'top', 'right', 'left'] as const).filter(p => p !== placement)
    ];
    for (const p of placements) {
      if (p === 'bottom') {
        top = rect.top + rect.height + GAP;
        left = rect.left + rect.width / 2 - CARD_W / 2;
        if (top + CARD_H_MIN < winH - 16) break;
      } else if (p === 'top') {
        top = rect.top - CARD_H_MIN - GAP;
        left = rect.left + rect.width / 2 - CARD_W / 2;
        if (top > 16) break;
      } else if (p === 'right') {
        top = rect.top + rect.height / 2 - CARD_H_MIN / 2;
        left = rect.left + rect.width + GAP;
        if (left + CARD_W < winW - 16) break;
      } else if (p === 'left') {
        top = rect.top + rect.height / 2 - CARD_H_MIN / 2;
        left = rect.left - CARD_W - GAP;
        if (left > 16) break;
      }
    }
    // Clamp into viewport.
    left = Math.max(16, Math.min(winW - CARD_W - 16, left));
    top = Math.max(16, Math.min(winH - CARD_H_MIN - 16, top));

    cardStyle = {
      position: 'fixed',
      top,
      left,
      width: CARD_W
    };
  }

  return (
    <>
      {/* Overlay with cutout */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[60]"
          style={{
            // box-shadow technique: a tiny transparent element with a huge
            // inset shadow dims everything outside its rect.
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(15,15,13,0.62)',
            borderRadius: 10,
            outline: '2px solid var(--brand, #c64a1f)',
            outlineOffset: 0,
            transition: 'top 0.2s, left 0.2s, width 0.2s, height 0.2s'
          }}
        />
      ) : (
        <div
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-[60] bg-ink-900/60"
        />
      )}

      {/* Tooltip card */}
      <div
        ref={cardRef}
        role="dialog"
        aria-label={`Tour step ${index + 1} of ${totalSteps}`}
        className="z-[70] rounded-lg border border-ink-200 bg-white shadow-2xl"
        style={cardStyle}
      >
        <div className="flex items-baseline justify-between gap-3 border-b border-ink-100 px-4 py-2.5">
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--brand, #c64a1f)' }}
            >
              Throughline · {index + 1} / {totalSteps}
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-ink-900">{step.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-800"
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-3 text-[13px] leading-relaxed text-ink-700">{step.body}</div>

        <div className="flex items-center justify-between gap-2 border-t border-ink-100 px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-ink-400 hover:text-ink-700"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIndex(i => Math.max(0, i - 1))}
              disabled={isFirst}
              className="flex items-center gap-1 rounded border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-3 w-3" />
              Back
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: 'var(--brand, #c64a1f)' }}
              >
                Done
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIndex(i => Math.min(totalSteps - 1, i + 1))}
                className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: 'var(--brand, #c64a1f)' }}
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
