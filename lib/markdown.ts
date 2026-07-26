import { marked } from 'marked';

// Markdown → sanitized HTML for operator-only surfaces. Strips the obvious
// script vectors; content is authored by Rhai (our own model), not third
// parties, so this is belt-and-braces rather than a hard trust boundary.
export function renderMarkdown(md: string): string {
  const html = marked.parse(md ?? '', { async: false }) as string;
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/ on\w+="[^"]*"/gi, '');
}

/** Strip markdown to plain text — for meta descriptions and JSON-LD. */
export function markdownToText(src: string): string {
  return (src ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First ~`max` characters of markdown as a clean summary (meta descriptions). */
export function excerpt(src: string, max = 155): string {
  const text = markdownToText(src);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = cut.lastIndexOf('. ');
  return (stop > max * 0.6 ? cut.slice(0, stop + 1) : `${cut.trimEnd()}…`).trim();
}

/**
 * Editorial prose styling — the public-site counterpart to PROSE_CLASS, sized
 * for reading a full article on the cream canvas rather than scanning a doc in
 * a panel.
 */
export const EDITORIAL_PROSE_CLASS =
  'text-[15px] leading-[1.75] text-ink-700 sm:text-base [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:tracking-tight [&_h2]:text-ink-900 [&_h3]:mt-7 [&_h3]:font-display [&_h3]:text-lg [&_h3]:text-ink-900 [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1.5 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold [&_strong]:text-ink-900 [&_em]:italic [&_blockquote]:my-6 [&_blockquote]:border-l-2 [&_blockquote]:border-accent/40 [&_blockquote]:pl-4 [&_blockquote]:font-display [&_blockquote]:text-lg [&_blockquote]:italic [&_blockquote]:text-ink-600 [&_code]:rounded [&_code]:bg-ink-100 [&_code]:px-1 [&_code]:text-[0.85em] [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-ink-900 [&_pre]:p-4 [&_pre]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:text-cream [&_hr]:my-8 [&_hr]:border-ink-200 [&_table]:my-5 [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:border-ink-100 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-ink-200 [&_th]:bg-cream-50 [&_th]:px-2 [&_th]:py-1';

// Shared prose styling for rendered markdown bodies (matches LeadDocuments).
export const PROSE_CLASS =
  'prose-doc text-sm leading-relaxed text-ink-800 [&_h1]:mt-0 [&_h1]:font-display [&_h1]:text-2xl [&_h2]:mt-5 [&_h2]:font-display [&_h2]:text-lg [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:my-0.5 [&_p]:my-2 [&_table]:my-3 [&_table]:w-full [&_table]:text-xs [&_td]:border [&_td]:border-ink-100 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-ink-200 [&_th]:bg-cream-50 [&_th]:px-2 [&_th]:py-1 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-accent [&_a]:underline [&_strong]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-ink-200 [&_blockquote]:pl-3 [&_blockquote]:text-ink-600 [&_code]:rounded [&_code]:bg-ink-100 [&_code]:px-1 [&_code]:text-[0.85em] [&_hr]:my-5 [&_hr]:border-ink-100';
