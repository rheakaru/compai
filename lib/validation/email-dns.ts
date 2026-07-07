import 'server-only';
import { resolveMx } from 'node:dns/promises';

// Server-only: does the email's domain actually run a mail server? We require
// a real MX record. This is what catches structurally-valid junk like
// "x@fgdfg.com" — a parked domain that resolves to a web host (A record) but
// publishes no MX, so it can't receive Rhea's reply. Every real mail provider
// (Gmail, Outlook, corporate, hosted email) publishes MX, so requiring it has
// a negligible false-reject rate while stopping typo/gibberish domains cold.
//
// We deliberately do NOT fall back to A records (RFC 5321 implicit MX): that
// fallback is exactly what let parked domains through.
//
// Verdicts:
//   'ok'         — has ≥1 MX record. Let through.
//   'no_domain'  — domain resolves but has no MX, or doesn't exist. Reject.
//   'unknown'    — DNS timed out or SERVFAIL'd. FAIL OPEN (let through) so a
//                  flaky resolver never blocks a real prospect.

export type MailDomainVerdict = 'ok' | 'no_domain' | 'unknown';

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('dns_timeout')), ms))
  ]);
}

export async function checkMailDomain(email: string): Promise<MailDomainVerdict> {
  const domain = email.split('@')[1]?.trim().toLowerCase();
  if (!domain || domain.includes(' ')) return 'no_domain';

  try {
    const mx = await withTimeout(resolveMx(domain), 3000);
    return mx.length > 0 && mx.some(r => r.exchange) ? 'ok' : 'no_domain';
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    // ENOTFOUND (domain doesn't exist) / ENODATA (exists, no MX) → reject.
    // Anything else (timeout, SERVFAIL, network) is inconclusive → fail open.
    if (code === 'ENOTFOUND' || code === 'ENODATA') return 'no_domain';
    return 'unknown';
  }
}
