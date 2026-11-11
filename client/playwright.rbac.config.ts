import { defineConfig } from "@playwright/test";
import foundation from "./playwright.config";

const port = process.env.E2E_CLIENT_PORT ?? "3100";
export default defineConfig({
  ...foundation,
  workers: 2,
  testMatch: "dashboard-rbac.spec.ts",
  use: {
    ...foundation.use,
    baseURL: `http://localhost:${port}`,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://localhost:${port}`,
          localStorage: [{ name: "ngc-language", value: "en" }],
        },
      ],
    },
  },
  webServer: {
    command: `npm run start -- --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
  },
});
