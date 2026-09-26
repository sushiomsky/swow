/** @type {import('next').NextConfig} */
const COMMUNITY_API_BASE = process.env.NEXT_PUBLIC_COMMUNITY_API_BASE || 'http://localhost:17000/api/community';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/community/:path*',
        destination: `${COMMUNITY_API_BASE}/:path*`
      }
    ];
  }
};

module.exports = nextConfig;
