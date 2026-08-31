import { NextRequest } from 'next/server';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import { requireFinance } from '@/lib/rhai/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Streams a company document for viewing/download. Finance/operator scope.
export async function GET(req: NextRequest) {
  const { error } = await requireFinance(req);
  if (error) return error;
  const id = req.nextUrl.searchParams.get('id') || '';
  const snap = await adminDb().collection('rhaiCompanyDocuments').doc(id).get();
  const v = snap.data() as { storagePath?: string; mime?: string; fileName?: string } | undefined;
  if (!v?.storagePath) return new Response('not found', { status: 404 });
  try {
    const [buf] = await adminBucket().file(v.storagePath).download();
    return new Response(new Uint8Array(buf), {
      headers: {
        'content-type': v.mime || 'application/octet-stream',
        'content-disposition': `inline; filename="${(v.fileName || 'document').replace(/"/g, '')}"`,
        'cache-control': 'private, max-age=3600'
      }
    });
  } catch {
    return new Response('unavailable', { status: 404 });
  }
}
