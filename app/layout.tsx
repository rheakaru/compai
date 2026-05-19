import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'compAI — structural diagnosis for businesses',
  description:
    'Paste a company URL. Get an evidence-backed read of its structural shape, what is hard for that shape, and which solved domains transfer.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
