// Ownership: Next runtime boundary for public/staff routes during strangler migration.
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: false },
      { source: "/app.html", destination: "/app", permanent: false },
    ];
  },
};

export default nextConfig;
