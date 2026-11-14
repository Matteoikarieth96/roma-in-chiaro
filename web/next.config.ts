import path from "node:path";
import type { NextConfig } from "next";

/* Export statico: `npm run build` scrive il sito in out/, file semplici senza server.
   Gli snapshot si leggono da ../data/snapshot (vedi scripts/prepare-data.mjs), quindi la radice
   del progetto per il bundler è la cartella sopra web/.
   NEXT_PUBLIC_BASE_PATH serve solo se il sito va pubblicato in una sottocartella (es. /municipi). */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: basePath || undefined,
  images: { unoptimized: true },
  poweredByHeader: false,
  turbopack: { root: path.join(__dirname, "..") },
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default config;
