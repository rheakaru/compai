import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, parseJsonLoose } from './server';
import { modelFor } from './models';
import type { ExtractedInvoice, InvoiceCurrency, InvoiceLineItem } from './invoices';

// Pull structured fields out of an uploaded invoice (PDF or image) using
// Claude's native document/image support — no parsing library. Best-effort:
// anything it can't find comes back undefined and the operator fills it in.

const EXTRACT_PROMPT = [
  'This is an invoice. Extract its details and return ONLY a JSON object — no prose, no code fence.',
  'Shape:',
  '{',
  '  "invoiceNumber": "<the invoice number/ID, or omit>",',
  '  "client": "<who is being billed — the customer/bill-to name, NOT the sender>",',
  '  "amount": <grand total as a number, no currency symbol or commas>,',
  '  "currency": "INR" | "USD" (infer from ₹/Rs/INR or $/USD; omit if unclear),',
  '  "issueDate": "YYYY-MM-DD (the invoice/issue date)",',
  '  "dueDate": "YYYY-MM-DD (payment due date, or omit)",',
  '  "lineItems": [{ "description": "...", "quantity": <num?>, "rate": <num?>, "amount": <num> }],',
  '  "notes": "<payment terms or anything notable, or omit>"',
  '}',
  'Use the GRAND TOTAL (after tax/discount) for "amount". Omit any field you cannot read confidently.'
].join('\n');

function isImage(mime: string): boolean {
  return mime.startsWith('image/');
}

export async function extractInvoiceFields(
  buffer: Buffer,
  mime: string
): Promise<ExtractedInvoice> {
  const isPdf = mime === 'application/pdf';
  if (!isPdf && !isImage(mime)) {
    // Non-visual formats aren't supported for structured extraction here.
    return {};
  }

  const source = isPdf
    ? { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') }
    : { type: 'base64', media_type: mime, data: buffer.toString('base64') };

  const msg = await anthropic().messages.create({
    model: modelFor('transcribe'),
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: [
          { type: isPdf ? 'document' : 'image', source },
          { type: 'text', text: EXTRACT_PROMPT }
        ] as unknown as Anthropic.Messages.MessageParam['content']
      }
    ]
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonLoose<Record<string, unknown>>(text);
  } catch {
    return {};
  }
  return sanitize(parsed);
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return undefined;
}

function str(v: unknown, max = 200): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

function isoDate(v: unknown): string | undefined {
  const s = str(v, 10);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

function sanitize(raw: Record<string, unknown>): ExtractedInvoice {
  const currency = str(raw.currency, 3)?.toUpperCase();
  const lineItems = Array.isArray(raw.lineItems)
    ? (raw.lineItems as unknown[])
        .map((li): InvoiceLineItem | null => {
          if (typeof li !== 'object' || li === null) return null;
          const o = li as Record<string, unknown>;
          const amount = num(o.amount) ?? 0;
          const description = str(o.description, 300) ?? '';
          if (!description && !amount) return null;
          return {
            description,
            amount,
            ...(num(o.quantity) !== undefined ? { quantity: num(o.quantity) } : {}),
            ...(num(o.rate) !== undefined ? { rate: num(o.rate) } : {})
          };
        })
        .filter((x): x is InvoiceLineItem => x !== null)
        .slice(0, 40)
    : undefined;

  return {
    invoiceNumber: str(raw.invoiceNumber, 60),
    client: str(raw.client, 200),
    amount: num(raw.amount),
    currency: currency === 'USD' ? 'USD' : currency === 'INR' ? ('INR' as InvoiceCurrency) : undefined,
    issueDate: isoDate(raw.issueDate),
    dueDate: isoDate(raw.dueDate),
    ...(lineItems && lineItems.length ? { lineItems } : {}),
    notes: str(raw.notes, 500)
  };
}
