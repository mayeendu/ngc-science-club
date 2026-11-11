import { defineConfig } from "@playwright/test";
import foundation from "./playwright.rbac.config";
export default defineConfig({
  ...foundation,
  testMatch: "communication.spec.ts",
});
