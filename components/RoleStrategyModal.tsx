'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { CareerStrategyView } from './CareerStrategyView';
import type { CareerStrategyContent } from '@/lib/model/role';

interface RoleSummary {
  roleId: string;
  roleTitle: string;
  status: string;
  inviteeEmail: string | null;
  sourceOfTruthDoc: string | null;
  completedAt: number | null;
}

export function RoleStrategyModal({
  companyId,
  roleId,
  open,
  onClose
}: {
  companyId: string;
  roleId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<RoleSummary | null>(null);
  const [strategy, setStrategy] = useState<CareerStrategyContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !roleId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRole(null);
    setStrategy(null);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`/api/companies/${companyId}/roles/${roleId}/strategy`, {
          headers: token ? { authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          role: RoleSummary;
          strategy: CareerStrategyContent | null;
        };
        if (cancelled) return;
        setRole(data.role);
        setStrategy(data.strategy);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, roleId, companyId, getToken]);

  if (!open || !roleId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-6">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-ink-200 bg-white shadow-xl">
        <div className="flex items-baseline justify-between gap-4 border-b border-ink-200 px-5 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-ink-500">Role analysis</p>
            <h2 className="text-base font-semibold text-ink-900">
              {role?.roleTitle ?? 'Loading…'}
            </h2>
            {role?.inviteeEmail && (
              <p className="text-[11px] text-ink-500">{role.inviteeEmail}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <p className="text-sm text-ink-500">Loading…</p>}
          {error && (
            <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {error}
            </p>
          )}
          {!loading && !error && !strategy && (
            <p className="text-sm text-ink-500">
              No career strategy yet. The invitee may not have completed the role analysis.
            </p>
          )}
          {!loading && strategy && (
            <>
              {role?.sourceOfTruthDoc && (
                <div className="mb-4 rounded border border-ink-200 bg-ink-50/60 px-3 py-2 text-xs text-ink-700">
                  <span className="font-medium">Source-of-truth file: </span>
                  {role.sourceOfTruthDoc}
                </div>
              )}
              <CareerStrategyView strategy={strategy} />
            </>
          )}
        </div>

        <div className="border-t border-ink-200 px-5 py-3 text-[11px] text-ink-500">
          Same content the invitee sees. Raw text from their description is not shown — only the polished analysis. The invitee was informed this would be visible to you.
        </div>
      </div>
    </div>
  );
}
