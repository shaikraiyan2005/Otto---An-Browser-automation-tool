import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  transpilePackages: ["@otto/shared"],
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  devIndicators: false,
};

export default config;
