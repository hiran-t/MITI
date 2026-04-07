/** @type {import('next').NextConfig} */
const isElectron = process.env.ELECTRON_BUILD === 'true';
const isStandalone = process.env.STANDALONE_BUILD === 'true';

const nextConfig = {
  // Electron: static export (no server needed, loads from app:// protocol)
  // Standalone: Next.js standalone server for Docker/self-hosted
  output: isElectron ? 'export' : isStandalone ? 'standalone' : undefined,
  compress: true,
  poweredByHeader: false,

  // Experimental features (server-side only, not relevant for Electron static export)
  experimental: {
    serverComponentsExternalPackages: ['three'],
  },

  // Image optimization — must be unoptimized for static export / Electron
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    unoptimized: isElectron || isStandalone,
  },

  // Headers — not supported in static export mode
  async headers() {
    if (isElectron) return [];
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
