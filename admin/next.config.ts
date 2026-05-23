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
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'http', hostname: 'localhost' },
      // OAuth avatar providers
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: 'graph.facebook.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      // General fallback for any https image
      { protocol: 'https', hostname: '**' },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
  },
  outputFileTracingRoot: path.join(__dirname, '../'),
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  webpack: (config) => {
    // npm workspaces hoists packages to root node_modules — add it to resolve path
    config.resolve.modules = [
      ...(config.resolve.modules ?? ['node_modules']),
      path.resolve(__dirname, '../node_modules'),
    ];
    return config;
  },
};

export default nextConfig;
