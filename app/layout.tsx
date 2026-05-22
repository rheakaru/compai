import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { AuthBar } from '@/components/AuthBar';
import { ThroughlineMark } from '@/components/ThroughlineMark';

export const metadata: Metadata = {
  title: 'Throughline — structural diagnosis for businesses',
  description:
    'Paste a company URL. Get an evidence-backed read of its structural shape, what is hard for that shape, and which solved domains transfer.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ThroughlineMark />
          <div className="fixed right-4 top-3 z-40">
            <AuthBar />
          </div>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
