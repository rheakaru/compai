import type { MetadataRoute } from 'next';
import { OPEN_ROLES } from '@/lib/careers/roles';
import { allPosts } from '@/lib/writing/posts';

const SITE = 'https://heyrhai.com';

// Sitemap for the public marketing surface. Operator and candidate-private
// routes are excluded here and in robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/writing`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE}/workshops`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE}/workshops/modules`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/careers`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE}/hang-w-ai`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE}/hire`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/hire/how-it-works`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/diagnosis`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/talk`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 }
  ];

  const writing: MetadataRoute.Sitemap = allPosts().map(p => ({
    url: `${SITE}/writing/${p.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7
  }));

  const careers: MetadataRoute.Sitemap = OPEN_ROLES.map(r => ({
    url: `${SITE}/careers/${r.slug}`,
    lastModified: new Date(r.datePosted),
    changeFrequency: 'weekly',
    priority: 0.8
  }));

  return [...staticPages, ...writing, ...careers];
}
