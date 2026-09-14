import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // An unrelated lockfile in E:\WEB made Next.js guess the wrong workspace root
  turbopack: { root: __dirname },
};

export default nextConfig;
