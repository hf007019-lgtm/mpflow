/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      // Only proxy health check to Python — everything else handled by Next.js
      {
        source: "/api/health",
        destination: "http://localhost:8000/api/health",
      },
    ];
  },
};

module.exports = nextConfig;
