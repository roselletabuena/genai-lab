import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@genai-lab/contracts"],
};

export default nextConfig;
