import 'server-only';
import * as XLSX from 'xlsx';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from './server';
import { modelFor } from './models';

// Turn an uploaded client document into text Rhai can understand. Plain
// text/csv read directly; spreadsheets flattened to CSV per sheet; PDFs
// transcribed by Claude (native PDF support — no parsing lib). The extracted
// text is what feeds the lead's context; the original is kept in Storage for
// re-download.

export type DocKind = 'text' | 'csv' | 'spreadsheet' | 'pdf' | 'other';

export function classify(name: string, mime: string): DocKind {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (['xlsx', 'xls', 'xlsm'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel'))
    return 'spreadsheet';
  if (ext === 'csv' || mime === 'text/csv') return 'csv';
  if (['txt', 'md', 'markdown', 'json'].includes(ext) || mime.startsWith('text/')) return 'text';
  return 'other';
}

const MAX_EXTRACT_CHARS = 40_000;

export async function extractText(buffer: Buffer, name: string, mime: string): Promise<string> {
  const kind = classify(name, mime);

  if (kind === 'text' || kind === 'csv') {
    return buffer.toString('utf8').slice(0, MAX_EXTRACT_CHARS);
  }

  if (kind === 'spreadsheet') {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const parts = wb.SheetNames.map(sheet => {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheet]);
      return `## Sheet: ${sheet}\n${csv}`;
    });
    return parts.join('\n\n').slice(0, MAX_EXTRACT_CHARS);
  }

  if (kind === 'pdf') {
    // Claude reads PDFs natively via a document content block.
    const msg = await anthropic().messages.create({
      model: modelFor('transcribe'),
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') }
            },
            {
              type: 'text',
              text: 'Transcribe this document into clean markdown — preserve headings, tables (as markdown tables), and numbers exactly. Do not summarize or add commentary; just the faithful content.'
            }
          ] as unknown as Anthropic.Messages.MessageParam['content']
        }
      ]
    });
    return msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .slice(0, MAX_EXTRACT_CHARS);
  }

  return `(Uploaded file "${name}" — type ${mime || 'unknown'} isn't auto-readable. Rhai can still reference that it exists.)`;
}
