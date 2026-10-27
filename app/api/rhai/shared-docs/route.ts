import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { SHARED_DOCS } from '@/lib/shared-docs/registry';
import { COL_VIEWS, type DocView } from '@/lib/shared-docs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Operator view of who has opened each shared doc and how far they read.
export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const docs = await Promise.all(
    SHARED_DOCS.map(async d => {
      // Single-field filter, sorted in memory — no composite index needed.
      const snap = await adminDb().collection(COL_VIEWS).where('slug', '==', d.slug).limit(2000).get();
      const views = snap.docs
        .map(v => ({ id: v.id, ...(v.data() as DocView) }))
        .sort((a, b) => b.startedAt - a.startedAt);
      return { ...d, views };
    })
  );
  return Response.json({ docs });
}
