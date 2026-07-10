import { marked } from 'marked';

// Markdown → sanitized HTML for operator-only surfaces. Strips the obvious
// script vectors; content is authored by Rhai (our own model), not third
// parties, so this is belt-and-braces rather than a hard trust boundary.
export function renderMarkdown(md: string): string {
  const html = marked.parse(md ?? '', { async: false }) as string;
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/ on\w+="[^"]*"/gi, '');
}

// Shared prose styling for rendered markdown bodies (matches LeadDocuments).
export const PROSE_CLASS =
  'prose-doc text-sm leading-relaxed text-ink-800 [&_h1]:mt-0 [&_h1]:font-display [&_h1]:text-2xl [&_h2]:mt-5 [&_h2]:font-display [&_h2]:text-lg [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:my-0.5 [&_p]:my-2 [&_table]:my-3 [&_table]:w-full [&_table]:text-xs [&_td]:border [&_td]:border-ink-100 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-ink-200 [&_th]:bg-cream-50 [&_th]:px-2 [&_th]:py-1 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-accent [&_a]:underline [&_strong]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-ink-200 [&_blockquote]:pl-3 [&_blockquote]:text-ink-600 [&_code]:rounded [&_code]:bg-ink-100 [&_code]:px-1 [&_code]:text-[0.85em] [&_hr]:my-5 [&_hr]:border-ink-100';
