'use client';

// Shared public-site chrome for heyrhai.com — the marketing header and footer
// used by the homepage, the writing archive, and the careers pages, so every
// public surface carries the same nav, the same social links, and the same
// internal linking (which is also what makes the site legible to search and
// answer engines).

import Link from 'next/link';
import { useAuth } from './AuthProvider';

export const INSTAGRAM_URL = 'https://www.instagram.com/heyrhai/';
export const PERSONAL_SITE = 'https://rheakaru.github.io';
export const SUBSTACK_URL = 'https://rheakaruturi.substack.com';
export const WHATSAPP_GROUP = 'https://chat.whatsapp.com/BSZLG7tXuZm85IaaaVj7fN';
export const CONTACT_EMAIL = 'rhea@rosebazaar.in';

const NAV = [
  { href: '/#work', label: 'Work' },
  { href: '/writing', label: 'Writing' },
  { href: '/hang-w-ai', label: 'Hang w AI' },
  { href: '/careers', label: 'Careers' },
  { href: '/#contact', label: 'Contact' }
];

export function SiteHeader() {
  const { user } = useAuth();
  return (
    <header className="border-b border-ink-200/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-baseline gap-2 text-ink-900">
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
          <span className="font-display text-[17px] font-medium tracking-tight">Rhai</span>
        </Link>
        <div className="flex items-center gap-4 text-xs">
          {NAV.map(item => (
            <Link key={item.href} href={item.href} className="hidden text-ink-500 hover:text-ink-900 sm:inline">
              {item.label}
            </Link>
          ))}
          <Link
            href={user ? '/leads' : '/#contact'}
            className="whitespace-nowrap rounded-md border border-ink-300 bg-white/70 px-3 py-1.5 font-medium text-ink-800 hover:bg-white"
          >
            {user ? 'Dashboard →' : 'Start a conversation'}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-200/60">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="flex items-baseline gap-2 text-ink-900">
              <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
              <span className="font-display text-[17px] font-medium tracking-tight">Rhai</span>
            </p>
            <p className="mt-2 max-w-xs text-[11px] leading-relaxed text-ink-500">
              An AI practice by Rhea Karuturi. Workshops and intelligence dashboards for Indian companies —
              Bangalore and San Francisco.
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-x-10 gap-y-1.5 text-[11px] sm:grid-cols-3">
            <Link href="/#work" className="text-ink-500 hover:text-ink-900">What we do</Link>
            <Link href="/writing" className="text-ink-500 hover:text-ink-900">Writing</Link>
            <Link href="/careers" className="text-ink-500 hover:text-ink-900">Careers</Link>
            <Link href="/hang-w-ai" className="text-ink-500 hover:text-ink-900">Hang w AI</Link>
            <Link href="/hire" className="text-ink-500 hover:text-ink-900">Rhai Interviews</Link>
            <Link href="/diagnosis" className="text-ink-500 hover:text-ink-900">Diagnosis tool</Link>
            <Link href="/talk" className="text-ink-500 hover:text-ink-900">Talk to Rhai</Link>
            <Link href="/privacy" className="text-ink-500 hover:text-ink-900">Privacy</Link>
          </nav>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-ink-200/60 pt-5 text-[11px] text-ink-400">
          <p>© {new Date().getFullYear()} Rhai · Rhea Karuturi</p>
          <p className="flex flex-wrap items-center gap-4">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-ink-500 hover:text-accent"
              aria-label="Rhai on Instagram — @heyrhai"
            >
              <InstagramGlyph />
              @heyrhai
            </a>
            <a href={SUBSTACK_URL} target="_blank" rel="noreferrer" className="hover:text-ink-700">
              Substack
            </a>
            <a href={PERSONAL_SITE} target="_blank" rel="noreferrer" className="hover:text-ink-700">
              rheakaru.github.io
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink-700">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Inline Instagram mark — no icon dependency, inherits currentColor. */
export function InstagramGlyph({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
