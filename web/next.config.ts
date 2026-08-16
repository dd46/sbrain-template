import type { NextConfig } from "next";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

const repoRoot = path.join(__dirname, "..");
loadEnvConfig(repoRoot);

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  serverExternalPackages: ["neo4j-driver", "@xenova/transformers"],
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
