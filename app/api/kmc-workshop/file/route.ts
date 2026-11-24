import { KMC_FILE_NAME, KMC_INTERVIEW_MD } from '@/lib/kmc-workshop/files';

// Public download for /kmc-workshop. No gate: anyone with the link can have it.
export const dynamic = 'force-static';

export function GET() {
  return new Response(KMC_INTERVIEW_MD, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${KMC_FILE_NAME}"`,
      'x-robots-tag': 'noindex'
    }
  });
}
