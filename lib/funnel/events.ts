import 'server-only';
import { randomUUID } from 'node:crypto';
import { adminDb } from '@/lib/firebase/admin';

export type FunnelStage =
  | 'url_submitted'
  | 'profile_viewed'
  | 'edit_started'
  | 'edit_blocked_by_auth'
  | 'signed_in'
  | 'edit_saved'
  | 'projects_requested'
  | 'stack_submitted'
  | 'projects_viewed'
  | 'analogy_floor_cleared'
  | 'analogy_honest_stop'
  | 'session_plan_viewed'
  | 'session_plan_gate_passed'
  | 'context_graph_exported';

export interface FunnelEvent {
  id: string;
  sessionId: string;
  ownerUid: string | null;
  companyId: string | null;
  companyUrl: string | null;
  stage: FunnelStage;
  meta: Record<string, unknown>;
  createdAt: number;
}

export async function logFunnelEvent(opts: {
  sessionId: string;
  ownerUid: string | null;
  companyId?: string | null;
  companyUrl?: string | null;
  stage: FunnelStage;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const id = randomUUID();
  const event: FunnelEvent = {
    id,
    sessionId: opts.sessionId,
    ownerUid: opts.ownerUid,
    companyId: opts.companyId ?? null,
    companyUrl: opts.companyUrl ?? null,
    stage: opts.stage,
    meta: opts.meta ?? {},
    createdAt: Date.now()
  };
  try {
    await adminDb().collection('funnelEvents').doc(id).set(event);
  } catch {
    // funnel telemetry must never break the user-facing flow
  }
}
