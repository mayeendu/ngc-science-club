import { defineConfig } from "@playwright/test";
import foundation from "./playwright.rbac.config";
export default defineConfig({ ...foundation, testMatch: ["faculty.spec.ts", "feedback.spec.ts", "communication.spec.ts", "quizzes.spec.ts", "assessments.spec.ts", "dashboard-rbac.spec.ts", "events.spec.ts", "members.spec.ts", "analytics.spec.ts", "performance.spec.ts"] });
