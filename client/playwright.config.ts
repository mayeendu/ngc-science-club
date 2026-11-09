import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_CHANNEL ?? "chromium",
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        channel: process.env.PLAYWRIGHT_CHANNEL ?? "chromium",
      },
    },
  ],
  webServer: [
    {
      command: "npm --prefix ../server run start",
      url: "http://localhost:4000/api/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run start",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
