/** @type {import('next').NextConfig} */
const isStandalone = process.env.STANDALONE_BUILD === 'true';

const nextConfig = {
  // Standalone: Next.js standalone server for Docker/self-hosted
  output: isStandalone ? 'standalone' : undefined,
  compress: true,
  poweredByHeader: false,

  // Shown in the workspace status bar
  env: {
    NEXT_PUBLIC_APP_VERSION: require('./package.json').version,
  },

  // Server-side packages
  serverExternalPackages: ['three'],

  // Standalone builds serve images unoptimized, so sharp's native binaries stay out of them: they
  // would tie the .deb and the image to the build machine. Nor does the server read ros/ or docs/.
  outputFileTracingExcludes: isStandalone
    ? { '*': ['node_modules/sharp/**', 'node_modules/@img/**', 'ros/**', 'docs/**'] }
    : undefined,

  // Standalone deployments serve images without an optimization service
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    unoptimized: isStandalone,
  },

  // Security headers
  async headers() {
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
