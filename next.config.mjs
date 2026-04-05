/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Required for @neondatabase/serverless in edge-compatible routes
  },
  // Allow images from external sources if needed in the future
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
