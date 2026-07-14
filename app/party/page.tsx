import type { Metadata } from 'next';
import { Fraunces, JetBrains_Mono } from 'next/font/google';
import { PartyInvite } from '@/components/PartyInvite';

// The launch-party invite (heyrhai.com/party) gets the real brand fonts —
// self-hosted via next/font so nothing is fetched from Google at runtime.
const fraunces = Fraunces({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-party-serif', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-party-mono', display: 'swap' });

const TITLE = 'You’re invited — Rhai';
const DESCRIPTION = 'Come celebrate — Episode X of Hang w AI, and a launch to share. Sunday 19 July 2026, 3 PM, Bengaluru.';
const OG_IMAGE = 'https://heyrhai.com/party-og.png';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false }, // invite-only — shared by link
  // Link-preview card (WhatsApp / iMessage / Twitter) shows the invite branding.
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://heyrhai.com/party',
    siteName: 'Rhai',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'You’re invited — Rhai launch party' }]
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE]
  }
};

export default function PartyPage() {
  return (
    <div className={`${fraunces.variable} ${jetbrains.variable}`}>
      <PartyInvite />
    </div>
  );
}
