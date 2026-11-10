import { defineConfig } from "@playwright/test";
import foundation from "./playwright.config";

const port = process.env.E2E_CLIENT_PORT ?? "3100";

export default defineConfig({
  ...foundation,
  testMatch: "signup.spec.ts",
  use: { ...foundation.use, baseURL: `http://localhost:${port}` },
  // Signup tests mock auth HTTP responses; no database or test accounts are needed.
  webServer: {
    command: `npm run start -- --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
  },
});
