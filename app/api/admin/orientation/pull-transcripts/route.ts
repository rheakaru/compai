import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { fetchTranscript, listRecentTranscripts } from '@/lib/rhai/fireflies';
import { TRANSCRIPTS_DOC, type PitchTranscript } from '@/lib/rhai/onboarding-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Operator-only: pull the sample pitch calls from Fireflies and store them for
// the intern's "how we actually pitch" module. Matches by title so Rhea can
// re-run it as newer calls come in. Longer transcripts are trimmed so the page
// stays readable — the point is to hear the shape of a call, not every word.
const WANT = ['hester', 'halol', 'century'];
const MAX_SENTENCES = 120;

function dateLabel(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  let recent;
  try {
    recent = await listRecentTranscripts(180);
  } catch (e) {
    return Response.json({ ok: false, error: `Fireflies list failed: ${e instanceof Error ? e.message : 'error'}` });
  }

  // Pick the most recent transcript whose title contains each wanted keyword.
  const picks = WANT.map(kw => {
    const matches = recent
      .filter(t => (t.title || '').toLowerCase().includes(kw))
      .sort((a, b) => (b.date || 0) - (a.date || 0));
    return { kw, match: matches[0] };
  });

  const calls: PitchTranscript[] = [];
  const missing: string[] = [];
  for (const { kw, match } of picks) {
    if (!match) {
      missing.push(kw);
      continue;
    }
    try {
      const full = await fetchTranscript(match.id);
      const sentences = (full?.sentences ?? [])
        .filter(s => s.text?.trim())
        .slice(0, MAX_SENTENCES)
        .map(s => ({ speaker: s.speaker_name || 'Speaker', text: (s.text || '').trim() }));
      calls.push({
        id: match.id,
        title: match.title || kw,
        dateLabel: dateLabel(match.date),
        ...(full?.summary?.overview ? { overview: full.summary.overview } : {}),
        sentences
      });
    } catch {
      missing.push(kw);
    }
  }

  await adminDb().doc(TRANSCRIPTS_DOC).set({ calls, pulledAt: Date.now() }, { merge: true });
  return Response.json({ ok: true, pulled: calls.map(c => c.title), missing });
}
