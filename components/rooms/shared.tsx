'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { WorkshopLead } from '@/lib/leads/types';
import { useAuthedFetch } from '../useAuthedFetch';

export interface LeadOption {
  id: string;
  label: string;
}

/** Rhai pipeline clients, for the "file this room to…" picker. */
export function useLeadOptions(enabled: boolean): LeadOption[] {
  const authedFetch = useAuthedFetch();
  const [opts, setOpts] = useState<LeadOption[]>([]);
  useEffect(() => {
    if (!enabled) return;
    void (async () => {
      const r = await authedFetch('/api/leads').catch(() => null);
      if (!r?.ok) return;
      const { leads } = (await r.json()) as { leads: WorkshopLead[] };
      setOpts(
        leads
          .map(l => {
            const company = l.company?.trim();
            const person = l.person?.trim();
            return {
              id: l.id,
              label: company && person ? `${company} — ${person}` : company || person || 'Untitled client'
            };
          })
          .sort((a, b) => a.label.localeCompare(b.label))
      );
    })();
  }, [enabled, authedFetch]);
  return opts;
}

export function roomUrl(id: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://heyrhai.com';
  return `${origin}/r/${id}`;
}

export function useQr(text: string | null, size = 512): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!text) return;
    QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0f0f0c', light: '#ffffff' } })
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [text, size]);
  return src;
}

export function LeadSelect({
  value,
  onChange,
  options,
  disabled
}: {
  value: string;
  onChange: (id: string) => void;
  options: LeadOption[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-500"
    >
      <option value="">No client</option>
      {options.map(o => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
