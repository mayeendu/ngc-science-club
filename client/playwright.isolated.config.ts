import { defineConfig } from "@playwright/test";
import foundation from "./playwright.rbac.config";
export default defineConfig({
  ...foundation,
  testMatch: "*.spec.ts",
  testIgnore: ["foundation.spec.ts", "i18n.spec.ts", "launch-flow.spec.ts"],
});
