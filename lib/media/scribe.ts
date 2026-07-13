import 'server-only';

// Shared ElevenLabs Scribe transcription for server routes that need a
// transcript from an audio buffer (testimonials). Kept separate from the
// public /api/transcribe route so we don't couple to it. Returns '' if the
// key isn't set or transcription fails — callers treat transcript as
// best-effort.
export async function transcribeAudio(buffer: Buffer, filename: string, mime: string): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return '';
  try {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)], { type: mime || 'audio/webm' }), filename);
    form.append('model_id', 'scribe_v1');
    form.append('language_code', 'eng');
    form.append('tag_audio_events', 'false');
    form.append('diarize', 'false');
    form.append('timestamps_granularity', 'none');
    const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': key },
      body: form
    });
    if (!res.ok) return '';
    const j = (await res.json()) as { text?: string };
    return (j.text ?? '').trim();
  } catch {
    return '';
  }
}
