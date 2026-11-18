import { NextRequest } from 'next/server';
import { viewerFromRequest } from '@/lib/shared-docs/server';
import { WORKSHOP_FILES, type WorkshopFileName } from '@/lib/cos-workshop/files';
import { recordDownload } from '@/lib/cos-workshop/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!(name in WORKSHOP_FILES)) return new Response('not found', { status: 404 });
  const viewer = await viewerFromRequest(req);
  if (!viewer) return Response.redirect(new URL('/chief-of-staff-workshop', req.url), 303);
  await recordDownload(viewer.email, name);
  return new Response(WORKSHOP_FILES[name as WorkshopFileName], {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'private, no-store'
    }
  });
}
