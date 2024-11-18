// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/test-images/**",
      },
      {
        protocol: "https",
        hostname: "*.onrender.com",
        pathname: "/test-images/**",
      },
      {
        protocol: "https",
        hostname: "*.pinimg.com",
      },
    ],
  },
};

module.exports = nextConfig;
