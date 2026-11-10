import { defineConfig, devices } from "@playwright/test";

const clientPort = process.env.E2E_CLIENT_PORT ?? "3000";
const serverPort = process.env.E2E_SERVER_PORT ?? "5000";
const clientOrigin = `http://localhost:${clientPort}`;
const apiOrigin = `http://localhost:${serverPort}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: "foundation.spec.ts",
  fullyParallel: true,
  use: {
    baseURL: clientOrigin,
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
      url: `${apiOrigin}/api/health`,
      reuseExistingServer: false,
      env: { PORT: serverPort, CLIENT_URL: clientOrigin },
    },
    {
      command: `npm run start -- --port ${clientPort}`,
      url: clientOrigin,
      reuseExistingServer: false,
      env: { API_URL: apiOrigin },
    },
  ],
});
