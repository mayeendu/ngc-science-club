import { defineConfig } from "@playwright/test";
import foundation from "./playwright.rbac.config";
export default defineConfig({
  ...foundation,
  testMatch: "i18n.spec.ts",
  use: { ...foundation.use, storageState: { cookies: [], origins: [] } },
});
