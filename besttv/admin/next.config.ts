import type { NextConfig } from 'next';
import path from 'path';

const assetsHost = (() => {
  const u = process.env.NEXT_PUBLIC_ASSETS_URL;
  if (!u) return null;
  try {
    return new URL(u).hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  transpilePackages: ['@besttv/shared'],
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '..'),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.r2.dev' },
      ...(assetsHost ? [{ protocol: 'https' as const, hostname: assetsHost }] : []),
      { protocol: 'http', hostname: 'localhost', port: '4100', pathname: '/media/**' },
      { protocol: 'https', hostname: '**', pathname: '/media/**' },
    ],
  },
  async rewrites() {
    const api = process.env.API_URL ?? 'http://localhost:4100';
    return [{ source: '/api/:path*', destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
