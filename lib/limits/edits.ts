import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import type { CompanyDoc } from '@/lib/model/claims';

/**
 * Free-tier edit budget. After this many edits the company doc is locked;
 * the only path forward is booking a session.
 *
 * Tunable in code (here) — operator-only. The 3 figure matches the user's
 * brief: "3 edits, then lock." We err on the strict side; raising is easy,
 * lowering would require explaining shrinkage to existing users.
 */
export const DEFAULT_MAX_EDITS = 3;

export interface EditState {
  editsUsed: number;
  maxEdits: number;
  lockedAt: number | null;
  remaining: number;
}

export function readEditState(company: CompanyDoc): EditState {
  const editsUsed = company.editsUsed ?? 0;
  const maxEdits = company.maxEdits ?? DEFAULT_MAX_EDITS;
  return {
    editsUsed,
    maxEdits,
    lockedAt: company.lockedAt ?? null,
    remaining: Math.max(0, maxEdits - editsUsed)
  };
}

export type ConsumeEditResult =
  | { ok: true; state: EditState }
  | { ok: false; reason: 'edit_limit_reached' | 'not_found'; state?: EditState };

/**
 * Atomically increment editsUsed and stamp lockedAt when the budget runs
 * out. Each editing endpoint calls this BEFORE doing its work — if the
 * limit is hit, the endpoint returns 423 (Locked) and skips the work.
 *
 * Idempotency: this is NOT idempotent. A retried call counts as a new edit.
 * Editing endpoints should be careful to call consumeEdit at most once per
 * user-visible action.
 */
export async function consumeEdit(companyId: string): Promise<ConsumeEditResult> {
  const db = adminDb();
  const ref = db.collection('companies').doc(companyId);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, reason: 'not_found' as const };
    const data = snap.data() as CompanyDoc;
    const editsUsed = data.editsUsed ?? 0;
    const maxEdits = data.maxEdits ?? DEFAULT_MAX_EDITS;
    if (editsUsed >= maxEdits) {
      return {
        ok: false,
        reason: 'edit_limit_reached' as const,
        state: { editsUsed, maxEdits, lockedAt: data.lockedAt ?? null, remaining: 0 }
      };
    }
    const next = editsUsed + 1;
    const update: Partial<CompanyDoc> = { editsUsed: next };
    if (next >= maxEdits) update.lockedAt = Date.now();
    tx.update(ref, update);
    return {
      ok: true,
      state: {
        editsUsed: next,
        maxEdits,
        lockedAt: next >= maxEdits ? Date.now() : null,
        remaining: Math.max(0, maxEdits - next)
      }
    };
  });
}

export function editLockedResponse(state?: EditState): Response {
  return new Response(
    JSON.stringify({
      error: 'edit_limit_reached',
      message:
        'You\'ve used all your free edits. Book a session to keep iterating, or contact Rhea.',
      state
    }),
    {
      status: 423,
      headers: { 'content-type': 'application/json' }
    }
  );
}
