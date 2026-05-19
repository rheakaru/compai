'use client';

import { useState } from 'react';
import type { BrandingSnapshot } from '@/lib/model/claims';

export function BrandHeader({
  url,
  branding,
  variant = 'company-page'
}: {
  url: string | null;
  branding: BrandingSnapshot | null;
  variant?: 'company-page' | 'inline';
}) {
  const [imgErr, setImgErr] = useState(false);

  const display = branding?.name ?? prettyHost(url);
  const logo = branding?.logoUrl && !imgErr ? branding.logoUrl : null;

  return (
    <div
      className={
        variant === 'company-page'
          ? 'border-b border-ink-200 bg-white'
          : 'mx-auto max-w-4xl border-b border-ink-100 px-6 pb-3'
      }
    >
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3 pr-44 text-xs text-ink-500">
        <div className="flex items-center gap-3 min-w-0">
          {logo ? (
            <img
              src={logo}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 flex-none rounded object-contain"
              onError={() => setImgErr(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-7 w-7 flex-none rounded bg-ink-100" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-900">{display}</p>
            {url && <p className="truncate text-[11px] text-ink-400">{url}</p>}
          </div>
        </div>
        <a href="/" className="text-ink-400 hover:text-ink-700">
          ← new
        </a>
      </div>
    </div>
  );
}

function prettyHost(url: string | null): string {
  if (!url) return 'company';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
