import { sveltekit } from "@sveltejs/kit/vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Standalone WebKit bench project for the switch-aware solver gate. It is a
// SEPARATE config — NOT one of the projects in vite.config.ts — so `bun run
// test` never runs it. Invoke it explicitly:
//   bunx vitest run --config vitest.bench.config.ts
//
// It drives the REAL solver.worker (`?worker` import) inside a headless WebKit
// page, the closest stand-in for the production Cloudflare-hosted SPA.
export default defineConfig({
  plugins: [
    sveltekit(),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/lib/paraglide",
      strategy: ["localStorage", "preferredLanguage", "baseLocale"],
    }),
  ],
  test: {
    name: "bench-webkit",
    include: ["scripts/bench-solver.webkit.ts"],
    // The hardest N=7 solve runs ~2 s plus cold worker startup; keep headroom.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "webkit" }],
      headless: true,
    },
  },
});
