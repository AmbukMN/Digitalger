import type { NextConfig } from 'next';
import path from 'path';

// R2_PUBLIC_URL (assets CDN) домэйныг next/image-д зөвшөөрнө.
// Ж: https://assets.besttv.us → { hostname: 'assets.besttv.us' }
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
  // Docker production — зөвхөн хэрэгтэй файлыг агуулсан жижиг image
  output: 'standalone',
  // besttv/ доторх lockfile-ийг workspace root гэж зөв танихад (DigitalGer
  // root-той хутгалдахгүй)
  outputFileTracingRoot: path.join(__dirname, '..'),
  images: {
    remotePatterns: [
      // R2 presigned URL — account-specific domain тул wildcard шаардлагатай
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      // Cloudflare R2 public dev домэйн (pub-xxx.r2.dev)
      { protocol: 'https', hostname: '**.r2.dev' },
      // Өөрийн assets CDN (NEXT_PUBLIC_ASSETS_URL-аас)
      ...(assetsHost ? [{ protocol: 'https' as const, hostname: assetsHost }] : []),
      // Локал storage драйвер (R2 тохируулаагүй үед /media/* dev/VPS-ээс)
      { protocol: 'http', hostname: 'localhost', port: '4100', pathname: '/media/**' },
      { protocol: 'https', hostname: '**', pathname: '/media/**' },
    ],
  },
  async rewrites() {
    const api = process.env.API_URL ?? 'http://localhost:4100';
    return {
      // ⚠️ /api/auth/[...nextauth] catch-all нь /api/auth/* БҮГДИЙГ барьж,
      // танихгүй action-д "not supported" алдаа өгдөг (жишээ: манай
      // /api/auth/guest, /api/auth/login). Тиймээс NextAuth-ийн ЗӨВХӨН
      // мэддэг action-уудыг (signin/signout/callback/session/csrf/providers)
      // filesystem route-д нь үлдээгээд, бусад /api/auth/* замыг (guest,
      // login, register, me, refresh, oauth, convert-guest, admin/login)
      // beforeFiles-ээр эрт нь backend руу шууд rewrite хийнэ.
      beforeFiles: [
        {
          source: '/api/auth/:path((?!signin|signout|callback|session|csrf|providers|error).*)',
          destination: `${api}/api/auth/:path`,
        },
      ],
      fallback: [{ source: '/api/:path*', destination: `${api}/api/:path*` }],
    };
  },
};

export default nextConfig;
