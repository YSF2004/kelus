import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// e2e against the static export, as shipped: build first, with the test analytics ID the specs expect, e.g.
//   NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST npm run build && npx playwright test -c playwright.static.config.ts
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "http://127.0.0.1:3200" },
  webServer: {
    command: "node scripts/serve-out.mjs out 3200",
    url: "http://127.0.0.1:3200/today/",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
