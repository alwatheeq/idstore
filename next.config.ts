import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  deploymentId: process.env.DEPLOYMENT_VERSION,
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
