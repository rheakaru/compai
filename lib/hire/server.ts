import 'server-only';
import { NextRequest } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader, type AuthedUser } from '@/lib/firebase/auth-server';
import { anthropic } from '@/lib/rhai/server';
import { modelFor } from '@/lib/rhai/models';
import {
  DEFAULT_HIRE_PRICING,
  DOC_HIRE_PRICING,
  type HireCompany,
  type HireJob,
  type HirePricing
} from './types';
import { COL_HIRE_COMPANIES, COL_HIRE_JOBS } from './types';

// Server helpers for the Rhai Interviews product. IMPORTANT: this product
// serves OTHER companies — never use Rhea's cofounder persona / context vault
// (buildRhaiSystemPrompt) here. All Claude calls run with neutral prompts that
// contain only the calling company's own data.

/** Any signed-in Google account (not operator-gated — this is the product). */
export async function requireUser(req: NextRequest): Promise<{ user?: AuthedUser; error?: Response }> {
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) return { error: new Response('unauthorized', { status: 401 }) };
  return { user };
}

/** The caller's company (doc id == uid), or null. */
export async function loadMyCompany(uid: string): Promise<HireCompany | null> {
  const snap = await adminDb().collection(COL_HIRE_COMPANIES).doc(uid).get();
  return snap.exists ? ({ id: snap.id, ...(snap.data() as Omit<HireCompany, 'id'>) } as HireCompany) : null;
}

/** A job the caller owns, or an error Response. */
export async function loadOwnedJob(
  uid: string,
  jobId: string
): Promise<{ job?: HireJob; error?: Response }> {
  const snap = await adminDb().collection(COL_HIRE_JOBS).doc(jobId).get();
  if (!snap.exists) return { error: new Response('not found', { status: 404 }) };
  const job = { id: snap.id, ...(snap.data() as Omit<HireJob, 'id'>) } as HireJob;
  if (job.companyId !== uid) return { error: new Response('forbidden', { status: 403 }) };
  return { job };
}

export async function loadHirePricing(): Promise<HirePricing> {
  const snap = await adminDb().doc(DOC_HIRE_PRICING).get();
  if (!snap.exists) return DEFAULT_HIRE_PRICING;
  return { ...DEFAULT_HIRE_PRICING, ...(snap.data() as Partial<HirePricing>) };
}

/** Neutral single-shot Claude call (no tools, no persona). Returns text. */
export async function runHire(params: {
  task?: 'suggest' | 'draft';
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const msg = await anthropic().messages.create({
    model: modelFor(params.task ?? 'suggest'),
    max_tokens: params.maxTokens ?? 2500,
    system: params.system,
    messages: [{ role: 'user', content: params.user }]
  });
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();
}

/** Fetch a website and strip it to readable text (for profile building). */
export async function fetchSiteText(url: string): Promise<string> {
  try {
    const u = url.startsWith('http') ? url : `https://${url}`;
    const res = await fetch(u, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; RhaiInterviews/1.0)' }
    });
    if (!res.ok) return '';
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z#0-9]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 9000);
  } catch {
    return '';
  }
}
