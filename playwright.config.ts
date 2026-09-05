import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const ciEnvironment: Record<string, string> = {};

for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined) ciEnvironment[key] = value;
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  outputDir: "test-results/artifacts",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: isCI ? "node .next/standalone/server.js" : "npm run dev -- --hostname 127.0.0.1 --port 3100",
    env: isCI ? { ...ciEnvironment, HOSTNAME: "127.0.0.1", PORT: "3100" } : undefined,
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: !isCI,
    timeout: 120_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }, { name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
});
