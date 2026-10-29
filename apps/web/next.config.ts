import path from "node:path";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import type { NextConfig } from "next";

export default function config(phase: string): NextConfig {
  return {
    output: "standalone",
    transpilePackages: ["@otto/shared"],
    // Monorepo root for the standalone (Docker) build only. Setting it in dev makes the dev server
    // watch apps/web/.next and reload in a loop whenever it writes its own log file.
    ...(phase === PHASE_PRODUCTION_BUILD ? { outputFileTracingRoot: path.resolve(process.cwd(), "../..") } : {}),
    devIndicators: false,
  };
}
