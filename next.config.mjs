import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfkit reads its AFM font metrics from disk at runtime; pdf-parse ships a
  // debug harness that trips the bundler — keep both unbundled (server-only).
  serverExternalPackages: ['pdfkit', 'pdf-parse'],
  outputFileTracingRoot: __dirname,
  // The writing archive reads its markdown from content/writing at runtime —
  // trace those files into the deployment for the routes that need them.
  outputFileTracingIncludes: {
    '/writing': ['./content/writing/**'],
    '/writing/[slug]': ['./content/writing/**'],
    '/sitemap.xml': ['./content/writing/**']
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb'
    }
  }
};

export default nextConfig;
