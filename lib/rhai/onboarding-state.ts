import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { ONBOARDING_TOKEN } from './onboarding';

// Shared loader for the intern's saved onboarding state, used by both the
// token-gated intern page and the operator-gated review page. Also carries the
// pitch-call transcripts pulled from Fireflies (rhaiConfig/onboardingTranscripts).

const COL = 'rhaiOnboarding';
export const TRANSCRIPTS_DOC = 'rhaiConfig/onboardingTranscripts';

export interface StoredSentence {
  speaker: string;
  text: string;
}
export interface PitchTranscript {
  id: string;
  title: string;
  dateLabel: string;
  overview?: string;
  sentences: StoredSentence[];
}

export function onboardingFileUrl(path: string): string {
  return `/api/rhai/onboarding/file?token=${encodeURIComponent(ONBOARDING_TOKEN)}&path=${encodeURIComponent(path)}`;
}

export interface OnboardingState {
  progress: string[];
  exercise: Record<string, string>;
  takeaways: Record<string, { transcript: string; audioUrl: string | null; at: number }>;
  docs: Record<string, { label: string; filename: string; url: string | null; at: number }>;
  pitchTranscripts: PitchTranscript[];
  transcriptsPulledAt: number | null;
}

export async function loadOnboardingState(): Promise<OnboardingState> {
  const [snap, tSnap] = await Promise.all([
    adminDb().collection(COL).doc(ONBOARDING_TOKEN).get(),
    adminDb().doc(TRANSCRIPTS_DOC).get()
  ]);
  const d = (snap.data() ?? {}) as Record<string, unknown>;
  const takeaways = (d.takeaways ?? {}) as Record<string, { transcript?: string; audioPath?: string; at?: number }>;
  const docs = (d.docs ?? {}) as Record<string, { label?: string; filename?: string; path?: string; at?: number }>;
  const t = (tSnap.data() ?? {}) as { calls?: PitchTranscript[]; pulledAt?: number };

  return {
    progress: (d.progress ?? []) as string[],
    exercise: (d.exercise ?? {}) as Record<string, string>,
    takeaways: Object.fromEntries(
      Object.entries(takeaways).map(([k, v]) => [
        k,
        { transcript: v.transcript ?? '', audioUrl: v.audioPath ? onboardingFileUrl(v.audioPath) : null, at: v.at ?? 0 }
      ])
    ),
    docs: Object.fromEntries(
      Object.entries(docs).map(([k, v]) => [
        k,
        { label: v.label ?? '', filename: v.filename ?? '', url: v.path ? onboardingFileUrl(v.path) : null, at: v.at ?? 0 }
      ])
    ),
    pitchTranscripts: Array.isArray(t.calls) ? t.calls : [],
    transcriptsPulledAt: typeof t.pulledAt === 'number' ? t.pulledAt : null
  };
}
