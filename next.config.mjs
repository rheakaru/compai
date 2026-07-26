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
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb'
    }
  }
};

export default nextConfig;
