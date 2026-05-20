import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@digitalger/shared'],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.digitalger.mn' },
      { protocol: 'https', hostname: 'assets.digitalger.mn' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: 'pub-*.r2.dev' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  outputFileTracingRoot: path.join(__dirname, '../'),
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  webpack: (config) => {
    config.resolve.modules = [
      ...(config.resolve.modules ?? ['node_modules']),
      path.resolve(__dirname, '../node_modules'),
    ];
    return config;
  },
};

export default nextConfig;
