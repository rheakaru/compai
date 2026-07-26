import { NextRequest } from 'next/server';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { generateAndStoreNda, loadNdaSettings } from '@/lib/rhai/nda';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const COL_NDAS = 'rhaiNdas';

interface NdaRecord {
  clientLegalName: string;
  filename: string;
  storagePath: string;
  leadId?: string;
  blanks: string[];
  signed: boolean;
  createdAt: number;
}

/** Settings status + recent NDAs. */
export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const [settings, recentSnap] = await Promise.all([
    loadNdaSettings(),
    adminDb().collection(COL_NDAS).orderBy('createdAt', 'desc').limit(15).get()
  ]);
  // Mint a fresh 1h download URL for each recent NDA so they stay downloadable
  // after the page is reopened (the original generate-time URL has expired).
  const recent = await Promise.all(
    recentSnap.docs.map(async d => {
      const data = d.data() as NdaRecord;
      let url: string | null = null;
      if (data.storagePath) {
        try {
          [url] = await adminBucket()
            .file(data.storagePath)
            .getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
        } catch {
          url = null;
        }
      }
      return { id: d.id, ...data, url };
    })
  );
  return Response.json({
    hasAddress: !!settings.address?.trim(),
    hasSignature: !!settings.signaturePath,
    recent
  });
}

/**
 * One-click NDA: {clientLegalName, leadId?, address?, cin?, purpose?} →
 * draft any missing fields from lead context → render + sign the PDF →
 * store it (and register it on the lead) → return a signed download URL.
 * Shared orchestration lives in lib/rhai/nda.ts (also used by the WhatsApp
 * generate_nda tool).
 */
export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const payload = (await req.json().catch(() => null)) as {
    clientLegalName?: string;
    leadId?: string;
    address?: string;
    cin?: string;
    purpose?: string;
  } | null;
  const clientLegalName = payload?.clientLegalName?.trim();
  if (!clientLegalName) return new Response('clientLegalName required', { status: 400 });

  const { url, filename, blanks, signed, lookedUp, sourceNote } = await generateAndStoreNda({
    clientLegalName,
    leadId: payload?.leadId,
    address: payload?.address,
    cin: payload?.cin,
    purpose: payload?.purpose
  });
  return Response.json({ url, filename, blanks, signed, lookedUp, sourceNote });
}
