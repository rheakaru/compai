import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sharedDoc } from '@/lib/shared-docs/registry';
import { COL_GATE_VISITS, requestMeta } from '@/lib/shared-docs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Anonymous count of people who reached the email gate — including those who
// left without entering an email. Sent from the browser, so link-preview bots
// (which don't run JS) aren't counted.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!sharedDoc(slug)) return new Response(null, { status: 204 });
  const { referrer } = (await req.json().catch(() => ({}))) as { referrer?: string };
  await adminDb()
    .collection(COL_GATE_VISITS)
    .add({ slug, at: Date.now(), referrer: String(referrer ?? '').slice(0, 300), ...requestMeta(req) });
  return new Response(null, { status: 204 });
}
