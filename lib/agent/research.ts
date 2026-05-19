import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { loadOntology } from '@/lib/ontology/loader';
import { buildResearchSystemPrompt } from './prompt';

let client: Anthropic | null = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface ResearchEvent {
  type: 'fact' | 'axis_position' | 'one_liner' | 'meta' | 'error' | 'done';
  [key: string]: unknown;
}

export async function* streamResearch(opts: {
  url: string;
  extraNotes?: string;
}): AsyncGenerator<ResearchEvent> {
  const { ontology } = loadOntology();
  const system = buildResearchSystemPrompt(ontology);

  const userMessage = [
    `Company URL: ${opts.url}`,
    opts.extraNotes ? `Additional notes from the user (weight these above scraped marketing copy):\n${opts.extraNotes}` : null,
    `\nResearch this company and emit NDJSON per the system instructions. Use web_search aggressively — at least one search for the company, one for the founders/leadership, and one for recent news or reviews.`
  ]
    .filter(Boolean)
    .join('\n\n');

  yield { type: 'meta', ontologyVersionHash: loadOntology().hash };

  let buffer = '';
  const flushLines = function* (): Generator<ResearchEvent> {
    let nl: number;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (obj && typeof obj === 'object' && 'type' in obj) {
          yield obj as ResearchEvent;
        }
      } catch {
        // skip — likely a partial line that landed mid-token; loop will pick it up next iteration
      }
    }
  };

  try {
    const stream = await getClient().messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 8000,
      system,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 8
        } as unknown as Anthropic.Messages.Tool
      ],
      messages: [{ role: 'user', content: userMessage }]
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        buffer += event.delta.text;
        for (const e of flushLines()) yield e;
      }
    }

    // Final flush — try to parse anything left in the buffer (no trailing newline).
    if (buffer.trim()) {
      try {
        const obj = JSON.parse(buffer.trim());
        if (obj && typeof obj === 'object' && 'type' in obj) {
          yield obj as ResearchEvent;
        }
      } catch {
        // discard — incomplete tail
      }
      buffer = '';
    }

    yield { type: 'done' };
  } catch (err) {
    yield { type: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
