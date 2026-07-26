import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  metadataBase: new URL('https://heyrhai.com'),
  title: {
    default: 'Rhai — AI workshops and intelligence dashboards for Indian companies',
    // Pages set their own full title; this keeps the brand on the ones that don't.
    template: '%s'
  },
  description:
    'Rhai is an AI consulting practice in Bangalore. We teach your team to build with AI in a day, and build the intelligence dashboards they run the business on. You own everything from minute one.',
  applicationName: 'Rhai',
  authors: [{ name: 'Rhea Karuturi', url: 'https://rheakaru.github.io' }],
  creator: 'Rhea Karuturi',
  publisher: 'Rhai',
  keywords: [
    'AI consulting India',
    'AI workshops Bangalore',
    'AI for Indian companies',
    'intelligence dashboard',
    'AI agents for business',
    'corporate AI training',
    'Claude workshops',
    'AI deployment consulting',
    'Rhea Karuturi',
    'Rhai'
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Rhai',
    locale: 'en_IN',
    url: 'https://heyrhai.com',
    title: 'Rhai — AI that runs inside your business',
    description:
      'An AI practice for founders. We teach your team to build with AI, and we build the intelligence dashboards they run the business on.'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rhai — AI that runs inside your business',
    description:
      'An AI practice for founders. Workshops and intelligence dashboards for Indian companies.'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 }
  },
  manifest: '/manifest.webmanifest',
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
