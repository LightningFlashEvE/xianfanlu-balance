import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const monorepoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const nextConfig: NextConfig = {
  transpilePackages: ["@xianfanlu/core", "@xianfanlu/database"],
  serverExternalPackages: ["@prisma/client"],
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
