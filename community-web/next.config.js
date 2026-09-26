/** @type {import('next').NextConfig} */
//
// Server-side proxy of Same-Origin `/api/community/*` to the Community-API.
//
// IMPORTANT: this destination is resolved inside the Node server process, so it
// must use an address reachable *from the container*, not from the browser:
//   - Docker Compose: http://community-api:7000/api/community (Docker DNS)
//   - Local dev without Docker (npm run dev): http://localhost:17000/api/community
//
// Configure via COMMUNITY_API_INTERNAL_BASE. NEXT_PUBLIC_COMMUNITY_API_BASE is
// the *browser-facing* base URL and must NOT be used here (localhost:17000 is
// the host mapping and refuses connections from inside this container).
const COMMUNITY_API_INTERNAL_BASE =
  process.env.COMMUNITY_API_INTERNAL_BASE || 'http://community-api:7000/api/community';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/community/:path*',
        destination: `${COMMUNITY_API_INTERNAL_BASE}/:path*`
      }
    ];
  }
};

module.exports = nextConfig;
