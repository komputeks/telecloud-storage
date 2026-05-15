import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  images: {
    remotePatterns: [
      { hostname: '*.telegram.org' },
      { hostname: 'api.telegram.org' },
      { hostname: '*.cloudfront.net' },
    ],
  },
};

export default nextConfig;
