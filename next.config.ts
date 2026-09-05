import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel's adapter owns output tracing there; standalone remains enabled for
  // the container deployment documented in this repository.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  deploymentId: process.env.DEPLOYMENT_VERSION,
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
