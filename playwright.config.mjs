import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${process.env.BOOKING_WEB_PORT ?? "4183"}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node scripts/serve-web-next.mjs",
    url: `http://127.0.0.1:${process.env.BOOKING_WEB_PORT ?? "4183"}`,
    env: { BOOKING_WEB_PORT: process.env.BOOKING_WEB_PORT ?? "4183" },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
