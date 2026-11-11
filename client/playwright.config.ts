import { defineConfig, devices } from "@playwright/test";

const clientPort = process.env.E2E_CLIENT_PORT ?? "3100";
const serverPort = process.env.E2E_SERVER_PORT ?? "5101";
const clientOrigin = `http://localhost:${clientPort}`;
const apiOrigin = `http://localhost:${serverPort}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: "foundation.spec.ts",
  fullyParallel: true,
  use: {
    baseURL: clientOrigin,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: clientOrigin,
          localStorage: [{ name: "ngc-language", value: "en" }],
        },
      ],
    },
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
      command: "npm --prefix ../server run test:serve",
      url: `${apiOrigin}/api/health`,
      reuseExistingServer: false,
      env: { E2E_SERVER_PORT: serverPort, E2E_CLIENT_PORT: clientPort },
    },
    {
      command: `npm run start -- --port ${clientPort}`,
      url: clientOrigin,
      reuseExistingServer: false,
      env: { API_URL: apiOrigin },
    },
  ],
});
