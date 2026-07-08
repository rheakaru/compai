import type { MetadataRoute } from 'next';

// Web app manifest — makes Rhai installable to the phone homescreen as a
// standalone app (no browser chrome). Next.js serves this at
// /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rhai — AI cofounder',
    short_name: 'Rhai',
    description: "Rhea Karuturi's AI cofounder — pipeline, ideas, tasks, discovery, invoices.",
    // Opens straight into the dashboard, not the marketing homepage.
    start_url: '/leads',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f2ea',
    theme_color: '#f6f2ea',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
