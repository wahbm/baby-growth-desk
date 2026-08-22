import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";

if (basePath && !basePath.startsWith("/")) {
  throw new Error("NEXT_PUBLIC_BASE_PATH must start with a slash");
}

const nextConfig: NextConfig = {
  basePath,
  output: "standalone",
};

export default nextConfig;
