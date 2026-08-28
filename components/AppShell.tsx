'use client';

// AppShell — the persistent top nav across every CompAI page. Three primary
// surfaces: Rhai (the AI-cofounder workspace at /leads), Diagnosis (the public
// 9-axis tool at /), and Funnel (operator metrics at /admin/funnel). The nav
// stays visible so nothing gets forgotten. Auth chip sits on the right;
// clicking the wordmark takes you home.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

interface NavItem {
  href: string;
  label: string;
  /** Match by exact pathname or by prefix. */
  match: (path: string) => boolean;
}

const NAV: NavItem[] = [
  { href: '/leads', label: 'Rhai', match: p => p.startsWith('/leads') },
  { href: '/diagnosis', label: 'Diagnosis', match: p => p.startsWith('/diagnosis') || p.startsWith('/c/') },
  { href: '/admin/funnel', label: 'Funnel', match: p => p.startsWith('/admin') }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';

  // Public candidate-facing interview pages get neutral chrome — no nav into
  // the dashboard, no sign-in chip. Just the wordmark.
  if (pathname.startsWith('/interview') || pathname.startsWith('/talk') || pathname.startsWith('/privacy')) {
    return (
      <div className="min-h-screen">
        <header className="border-b border-ink-200/70 bg-cream/85">
          <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
            <span className="flex items-baseline gap-2 text-ink-900">
              <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
              <span className="font-display text-[17px] font-medium tracking-tight">Rhai</span>
            </span>
          </div>
        </header>
        <div>{children}</div>
      </div>
    );
  }

  // Rhai company homepage, its marketing pages, and the Hire product — they
  // bring their own top bar. Candidate /apply pages are public + bare too.
  if (
    pathname === '/' ||
    pathname === '/hang-w-ai' ||
    pathname.startsWith('/workshops') ||
    pathname.startsWith('/careers') ||
    pathname.startsWith('/writing') ||
    pathname.startsWith('/hire') ||
    pathname.startsWith('/apply') ||
    pathname.startsWith('/testimonial') ||
    pathname.startsWith('/orient') ||
    pathname.startsWith('/party') ||
    pathname.startsWith('/join')
  ) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="min-h-screen">
      <TopNav pathname={pathname} />
      <div>{children}</div>
    </div>
  );
}

function TopNav({ pathname }: { pathname: string }) {
  const { user, signIn, signOut, loading } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-cream/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:gap-8 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2 text-ink-900">
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
          <span className="font-display text-[17px] font-medium tracking-tight">CompAI</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {NAV.map(item => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2 py-1.5 transition-colors sm:px-3 ${
                  active
                    ? 'bg-white text-ink-900 shadow-[0_1px_0_rgba(0,0,0,0.04)]'
                    : 'text-ink-600 hover:bg-white/60 hover:text-ink-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3 text-xs">
          {loading ? (
            <span className="text-ink-300">…</span>
          ) : user ? (
            <>
              <span className="hidden text-ink-500 sm:inline">{user.email}</span>
              <button
                type="button"
                onClick={() => signOut()}
                className="text-ink-400 hover:text-ink-700"
              >
                sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => signIn().catch(() => undefined)}
              className="rounded-md border border-ink-300 bg-white/70 px-3 py-1.5 font-medium text-ink-700 hover:bg-white"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
