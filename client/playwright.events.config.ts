import { defineConfig } from "@playwright/test";
import foundation from "./playwright.rbac.config";
export default defineConfig({
  ...foundation,
  workers: 1,
  testMatch: "events.spec.ts",
});
