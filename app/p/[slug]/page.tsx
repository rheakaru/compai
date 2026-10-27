import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { DECURVE_CSS, DeCurveDoc } from '@/components/shared-docs/DeCurve';
import { DocTracker } from '@/components/shared-docs/DocTracker';
import { EmailGate } from '@/components/shared-docs/EmailGate';
import { sharedDoc } from '@/lib/shared-docs/registry';
import { viewerFromRequest } from '@/lib/shared-docs/server';

export const dynamic = 'force-dynamic';

// Unlisted, email-gated document pages. The content is only rendered once the
// reader has a viewer cookie, so it never appears in the HTML of the gate.

const CONTENT: Record<string, { css: string; Doc: () => React.ReactElement }> = {
  decurve: { css: DECURVE_CSS, Doc: DeCurveDoc }
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = sharedDoc(slug);
  if (!doc) return {};
  return {
    title: doc.title,
    description: doc.description,
    robots: { index: false, follow: false },
    openGraph: { title: doc.title, description: doc.description, type: 'article' }
  };
}

export default async function SharedDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = sharedDoc(slug);
  const content = CONTENT[slug];
  if (!doc || !content) notFound();

  const viewer = await viewerFromRequest({ cookies: await cookies() }).catch(() => null);
  const { css, Doc } = content;

  return (
    <div className="dc">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap"
      />
      <style>{css}</style>
      {viewer ? (
        <DocTracker slug={slug}>
          <Doc />
        </DocTracker>
      ) : (
        <EmailGate slug={slug} title={doc.title} description={doc.description} author={doc.author} />
      )}
    </div>
  );
}
