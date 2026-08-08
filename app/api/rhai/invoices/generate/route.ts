import { NextRequest } from 'next/server';
import { requireOperator } from '@/lib/rhai/server';
import { generateAndStoreInvoice, type GenerateInvoiceInput } from '@/lib/rhai/invoice-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Generate a GST tax invoice PDF for RHAI CONSULTING GROUP PRIVATE LIMITED,
// store it, and record it in the invoice tracker (as a draft).
export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as GenerateInvoiceInput;
  try {
    const result = await generateAndStoreInvoice(body);
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'invoice generation failed' },
      { status: 400 }
    );
  }
}
