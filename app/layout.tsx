import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  metadataBase: new URL('https://heyrhai.com'),
  title: 'Rhai',
  description: 'Rhai — Rhea Karuturi’s AI cofounder for the AI workshop practice.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Rhai',
  appleWebApp: {
    capable: true,
    title: 'Rhai',
    statusBarStyle: 'default'
  },
  icons: {
    icon: [
      { url: '/icons/favicon-64.png', type: 'image/png', sizes: '64x64' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' }
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }]
  }
};

export const viewport: Viewport = {
  themeColor: '#f6f2ea',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
