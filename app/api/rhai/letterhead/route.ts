import { NextRequest } from 'next/server';
import { requireFinance } from '@/lib/rhai/server';
import { renderLetterheadPdf, letterheadFilename } from '@/lib/rhai/letterhead';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Letterhead tool (Accounting → Letterhead): drop in a Word .docx, get back a
// PDF of its content under the RHAI CONSULTING GROUP letterhead. Stateless — the
// PDF streams straight back to the browser to download; nothing is stored.

const MAX_BYTES = 15 * 1024 * 1024;
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function POST(req: NextRequest) {
  const { error } = await requireFinance(req);
  if (error) return error;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return new Response('Attach a Word document.', { status: 400 });

  const name = file.name || 'document.docx';
  const isDocx = name.toLowerCase().endsWith('.docx') || file.type === DOCX_MIME;
  if (!isDocx) {
    return new Response('Only Word .docx files are supported (not .doc, .pdf, or Google Docs — export as .docx first).', {
      status: 415
    });
  }
  if (file.size > MAX_BYTES) return new Response('That file is too large (max 15 MB).', { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let pdf: Buffer;
  try {
    pdf = await renderLetterheadPdf(buffer);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'Could not process that document.', { status: 422 });
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${letterheadFilename(name)}"`,
      'cache-control': 'no-store'
    }
  });
}
