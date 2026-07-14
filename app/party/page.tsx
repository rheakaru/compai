import type { Metadata } from 'next';
import { Fraunces, JetBrains_Mono } from 'next/font/google';
import { PartyInvite } from '@/components/PartyInvite';

// The launch-party invite (heyrhai.com/party) gets the real brand fonts —
// self-hosted via next/font so nothing is fetched from Google at runtime.
const fraunces = Fraunces({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-party-serif', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-party-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'You’re invited — Rhai',
  description: 'Episode X of Hang w AI, and a launch to celebrate. Saturday 18 July 2026, Bengaluru.',
  robots: { index: false, follow: false } // invite-only — shared by link
};

export default function PartyPage() {
  return (
    <div className={`${fraunces.variable} ${jetbrains.variable}`}>
      <PartyInvite />
    </div>
  );
}
