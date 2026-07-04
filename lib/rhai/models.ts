// Rhai model routing — which Claude model backs each kind of task. Rhea's
// stated preference: the heavy, high-taste work (building demo dashboards,
// deep company research) runs on the strongest models; everything routine
// (drafting, transcription, quick suggestions) runs on cheaper/faster ones.
//
// This is the single source of truth so a future settings page can let her
// override any row without touching call sites.

export const RHAI_MODELS = {
  /** Building out demo dashboards / apps for a client. */
  build: 'claude-opus-4-8',
  /** Deep research on a company or a person in her network. */
  research: 'claude-opus-4-8',
  /** Transcribing handwritten call notes from a photo. Vision-capable. */
  transcribe: 'claude-sonnet-5',
  /** Reading notes + pipeline and proposing next-step actions. */
  suggest: 'claude-sonnet-5',
  /** Drafting emails, proposals, invoice lines from templates. */
  draft: 'claude-haiku-4-5-20251001'
} as const;

export type RhaiTask = keyof typeof RHAI_MODELS;

export function modelFor(task: RhaiTask): string {
  return RHAI_MODELS[task];
}
