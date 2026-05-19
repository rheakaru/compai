'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../AuthProvider';
import { GateCommitmentPanel } from './GateCommitmentPanel';
import { SessionPlanView } from './SessionPlanView';
import { AuthGateModal } from '../AuthGateModal';
import type { SessionPlanContent } from '@/lib/agent/session-plan';
import type {
  GateCommitmentConfig,
  PaymentToggle,
  ResolvedGate
} from '@/lib/gate/commitment';

export function SessionPlanSection({
  companyId,
  companyName,
  gate,
  initialPlan
}: {
  companyId: string;
  companyName: string | null;
  gate: ResolvedGate;
  initialPlan: SessionPlanContent | null;
}) {
  const { user, getToken } = useAuth();
  const [plan, setPlan] = useState<SessionPlanContent | null>(initialPlan);
  const [authOpen, setAuthOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loggedViewRef = useViewLog(companyId);

  const submit = useCallback(
    async (values: Record<string, string>) => {
      if (!user) {
        setAuthOpen(true);
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const token = await getToken();
        const res = await fetch('/api/session-plan', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            companyId,
            commitment: values,
            variantId: gate.commitment.variantId
          })
        });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.reason || j?.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { plan: SessionPlanContent };
        setPlan(data.plan);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
    },
    [user, getToken, companyId, gate.commitment.variantId]
  );

  // Avoid unused warning when there's no loggedViewRef use elsewhere.
  void loggedViewRef;

  if (plan) {
    return <SessionPlanView plan={plan} />;
  }

  return (
    <>
      <GateCommitmentPanel
        commitment={gate.commitment}
        payment={gate.payment}
        companyName={companyName}
        onSubmit={submit}
        submitting={submitting}
        error={error}
      />
      <AuthGateModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSignedIn={() => setAuthOpen(false)}
      />
    </>
  );
}

function useViewLog(companyId: string) {
  const [logged, setLogged] = useState(false);
  useEffect(() => {
    if (logged) return;
    setLogged(true);
    fetch('/api/funnel/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stage: 'session_plan_viewed', companyId })
    }).catch(() => undefined);
  }, [companyId, logged]);
  return logged;
}

// Re-export the config shape so the Profile/server can type the prop.
export type { GateCommitmentConfig, PaymentToggle };
