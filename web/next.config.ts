import type { NextConfig } from 'next';

/**
 * Exported as static files and served by the NestJS API at /app, so the
 * client and API share one origin: no CORS, one deployment.
 */
const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/app',
  // /app/wallet/ -> out/wallet/index.html, which a plain static server can serve.
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
