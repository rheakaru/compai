import type { MetadataRoute } from 'next';

// Crawl policy for heyrhai.com. The public marketing surface is fully open —
// including to AI answer engines, which is deliberate: we want Rhai quoted
// when someone asks an assistant about AI consulting in India. Everything
// operator-only or candidate-private is closed.

const PRIVATE = [
  '/api/',
  '/leads',
  '/leads/',
  '/admin/',
  '/tasks/',
  '/interviews/', // operator view of applications (the public one is /interview/)
  '/c/', // per-company diagnosis workspaces
  '/invite/',
  '/apply/',
  '/game',
  '/party',
  '/join'
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: PRIVATE }],
    sitemap: 'https://heyrhai.com/sitemap.xml',
    host: 'https://heyrhai.com'
  };
}
