import type { Metadata } from 'next';
import { Fraunces, JetBrains_Mono } from 'next/font/google';
import { PartyInvite } from '@/components/PartyInvite';

// heyrhai.com/join — the request page for the broader community. Same 3D
// invite, but no venue: people request a spot, an operator approves, and the
// details unlock on the page. Real brand fonts, self-hosted via next/font.
const fraunces = Fraunces({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-party-serif', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-party-mono', display: 'swap' });

const TITLE = 'Request an invite — Rhai';
const DESCRIPTION = 'Episode X of Hang w AI, and a launch to share. Sunday 19 July 2026, Bengaluru. Request your spot.';
const OG_IMAGE = 'https://heyrhai.com/party-og.png';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false }, // shared by link
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://heyrhai.com/join',
    siteName: 'Rhai',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Request an invite — Rhai launch party' }]
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] }
};

export default function JoinPage() {
  return (
    <div className={`${fraunces.variable} ${jetbrains.variable}`}>
      <PartyInvite mode="request" />
    </div>
  );
}
