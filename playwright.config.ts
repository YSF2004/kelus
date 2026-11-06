import { defineConfig, devices } from "@playwright/test";

const browserExecutablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    // Exercise event capture in browser tests without using the production analytics property.
    env: {
      NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-TEST",
      // Production registers this worker automatically; opt into that same path only for the browser suite.
      NEXT_PUBLIC_E2E_SERVICE_WORKER: "1",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: browserExecutablePath ? { executablePath: browserExecutablePath } : undefined } }],
});
