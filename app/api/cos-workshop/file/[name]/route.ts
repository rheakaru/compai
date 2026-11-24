import { NextRequest } from 'next/server';
import { WORKSHOP_FILES, type WorkshopFileName } from '@/lib/cos-workshop/files';
import { passFromCookies, recordDownload } from '@/lib/cos-workshop/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!(name in WORKSHOP_FILES)) return new Response('not found', { status: 404 });
  const pass = await passFromCookies(req.cookies);
  // Relative Location: behind App Hosting req.url is the internal 0.0.0.0:8080 origin.
  if (!pass) return new Response(null, { status: 303, headers: { location: '/chief-of-staff-workshop' } });
  if (pass.email) await recordDownload(pass.email, name);
  return new Response(WORKSHOP_FILES[name as WorkshopFileName], {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'private, no-store'
    }
  });
}
