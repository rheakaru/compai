import 'server-only';

// Shared ElevenLabs Scribe transcription. Takes the ORIGINAL uploaded Blob
// (not a reconstructed one) — passing a Blob rebuilt from a Buffer through the
// Node fetch/FormData path doesn't encode as a valid multipart file, so Scribe
// returns nothing. Mirrors the working /api/transcribe call exactly. Returns
// '' if the key is unset or the call fails — transcript is best-effort.
export async function transcribeAudio(audio: Blob, filename: string): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return '';
  try {
    const form = new FormData();
    form.append('file', audio, filename);
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
