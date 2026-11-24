import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from '@/lib/rhai/server';
import { modelFor } from '@/lib/rhai/models';

// Is this voice note a real testimonial? Used where a testimonial is the price
// of entry (the Chief of Staff guide), so it must stop "test test", silence,
// gibberish and filler, while letting through anything a real person would
// say about the session: short, critical, Hindi/Hinglish, rambling, all fine.

export interface TestimonialVerdict {
  genuine: boolean;
  /** Shown to the person when genuine is false. */
  reason: string;
  /** 'rules' | 'model' | 'fail-open' (checker unavailable, let them through). */
  by: 'rules' | 'model' | 'fail-open';
}

const MIN_WORDS = 8;

export async function checkTestimonial(transcript: string, durationSec?: number): Promise<TestimonialVerdict> {
  const text = transcript.trim();
  const words = text.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w));
  if (!text) {
    return { genuine: false, reason: "We couldn't hear anything in that recording. Check your mic and try again.", by: 'rules' };
  }
  if (words.length < MIN_WORDS || (durationSec !== undefined && durationSec < 5)) {
    return { genuine: false, reason: 'That was a bit short. Say a sentence or two about the session: what you built, what clicked, or what could be better.', by: 'rules' };
  }

  try {
    const msg = await anthropic().messages.create({
      model: modelFor('digest'),
      max_tokens: 150,
      system: [
        'You check voice-note transcripts left as testimonials after an AI workshop or community session run by Rhea (Rhai). Transcription may misspell names (Ria, Riya, Rai = Rhea).',
        'GENUINE: the person says anything real about their experience, such as what they learned or built, what they liked or disliked, who it is for, thanks with some substance. Any language or mix (Hindi, Hinglish…) is fine. Short, hesitant, rambling or critical notes are genuine.',
        'NOT GENUINE: mic tests ("test", "testing 1 2 3", "this is a test voice note"), gibberish, reading out random text or a song, counting, only "hi"/"thanks"/"good" with nothing else, content unrelated to the session, spam or abuse.',
        'When unsure, answer genuine. Reply with ONLY JSON: {"genuine":true|false,"reason":"<if false: one short, kind sentence telling them what to say instead>"}'
      ].join('\n'),
      messages: [{ role: 'user', content: `Transcript:\n"""${text.slice(0, 4000)}"""` }]
    });
    const out = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');
    const m = /\{[\s\S]*\}/.exec(out);
    const j = m ? (JSON.parse(m[0]) as { genuine?: boolean; reason?: string }) : null;
    if (!j || typeof j.genuine !== 'boolean') return { genuine: true, reason: '', by: 'fail-open' };
    return {
      genuine: j.genuine,
      reason: j.genuine ? '' : String(j.reason || 'Tell us a little about the session: what you built, what clicked, or what could be better.').slice(0, 240),
      by: 'model'
    };
  } catch {
    return { genuine: true, reason: '', by: 'fail-open' };
  }
}
