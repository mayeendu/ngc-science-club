import { defineConfig } from "@playwright/test";
import foundation from "./playwright.rbac.config";
export default defineConfig({
  ...foundation,
  workers: 1,
  testMatch: "launch-flow.spec.ts",
  webServer: [
    {
      command: "npm --prefix ../server run test:launch:serve",
      url: "http://127.0.0.1:5102/api/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run start -- --port 3100",
      url: "http://localhost:3100",
      reuseExistingServer: false,
    },
  ],
});
