// Isomorphic contact-field validation — shared by the public chat forms
// (client, instant feedback) and the discovery/interview API routes (server,
// authoritative). No Node or 'server-only' imports so it's safe to bundle
// into client components. The DNS-level "can this domain receive mail" check
// lives separately in email-dns.ts (server-only) because it needs node:dns.

export interface ContactInput {
  name: string;
  email: string;
  phone: string;
}

export interface ContactErrors {
  name?: string;
  email?: string;
  phone?: string;
}

// Structurally valid address: something@something.tld, tld ≥ 2 chars, no spaces.
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export function isValidEmailFormat(email: string): boolean {
  const e = email.trim();
  return e.length <= 254 && EMAIL_RE.test(e);
}

/** Strip to digits (keeping a leading +), for storage + counting. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

export function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  // ITU E.164: max 15 digits. Real numbers are ≥7 (shortest national numbers).
  if (digits.length < 7 || digits.length > 15) return false;
  // Reject placeholder mashes like 0000000 / 8888888888.
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}

/** Indian mobile: EXACTLY 10 numeric digits (no country code). Used by the
 *  first-round interview form, which requires a local 10-digit mobile. */
export function isValidIndianMobile(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 10) return false;
  if (/^(\d)\1+$/.test(digits)) return false; // reject 0000000000 etc.
  return true;
}

// Name must have ≥2 chars and contain an actual letter (Latin, accented Latin,
// or Devanagari — covers our audience). Doesn't try to catch every gibberish
// string ("asdf" will pass); it stops empty/numeric/symbol-only junk.
const NAME_LETTER_RE = /[A-Za-zÀ-ɏऀ-ॿ]/;

export function isValidName(raw: string): boolean {
  const n = raw.trim();
  return n.length >= 2 && NAME_LETTER_RE.test(n);
}

export interface ContactFormatOptions {
  /** 'e164' (default): 7–15 digits. 'in10': exactly 10 digits (interview). */
  phoneMode?: 'e164' | 'in10';
}

/** Synchronous format validation. Returns per-field messages (empty = valid). */
export function validateContactFormat(input: ContactInput, opts: ContactFormatOptions = {}): ContactErrors {
  const errors: ContactErrors = {};
  if (!isValidName(input.name)) errors.name = 'Please enter your name.';
  if (!isValidEmailFormat(input.email)) errors.email = 'Enter a valid email address.';
  if (opts.phoneMode === 'in10') {
    if (!isValidIndianMobile(input.phone)) errors.phone = 'Enter a valid 10-digit mobile number.';
  } else if (!isValidPhone(input.phone)) {
    errors.phone = 'Enter a valid phone number, including country or area code.';
  }
  return errors;
}

/** First error message, for forms that show a single line. */
export function firstError(errors: ContactErrors): string | null {
  return errors.name ?? errors.email ?? errors.phone ?? null;
}
