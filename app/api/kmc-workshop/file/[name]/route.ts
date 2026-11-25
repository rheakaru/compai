import { KMC_FILES, type KmcFileName } from '@/lib/kmc-workshop/files';

// Public downloads for /kmc-workshop. No gate: anyone with the link can have them.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(KMC_FILES).map(name => ({ name }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!(name in KMC_FILES)) return new Response('not found', { status: 404 });
  return new Response(KMC_FILES[name as KmcFileName], {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
      'x-robots-tag': 'noindex'
    }
  });
}
