import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Deploys to Cloudflare Workers with Static Assets. The app is fully
    // prerendered (ssr=false in +layout.ts), so the worker just serves the
    // built assets.
    adapter: adapter(),
  },
};
export default config;
