import process from "node:process";
import { randomBytes } from "node:crypto";
import { memoryAdapter } from "better-auth/adapters/memory";
import { memoryDatabase } from "../tests/helpers/communication-memory.mjs";
Object.assign(process.env, {
  NODE_ENV: "test",
  NGC_ISOLATED_TEST: "1",
  CLIENT_URL: "http://localhost:3100",
  BETTER_AUTH_URL: "http://localhost:5102",
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  MONGODB_URI: "mongodb://127.0.0.1:1",
  DB_NAME: "fictional_launch_memory_only",
});
const { createApp } = await import("../dist/app.js");
const { createAuthWithDatabase } = await import("../dist/lib/auth.js");
const { createApplicationRepository } =
  await import("../dist/modules/membership-applications/application.repository.js");
const { createFeedbackRepository } =
  await import("../dist/modules/feedback/feedback.repository.js");
const { createNotificationRepository } =
  await import("../dist/modules/communication/notification.repository.js");
const memory = { user: [], account: [], session: [], verification: [] },
  data = {};
const database = () => memoryDatabase(data);
const auth = createAuthWithDatabase(memoryAdapter(memory));
createApp(auth, {
  lookupAuthorizationUser: async (id) =>
    memory.user.find((user) => user.id === id) ?? null,
  applicationRepository: createApplicationRepository(database),
  feedbackRepository: createFeedbackRepository(database),
  notificationRepository: createNotificationRepository(database),
  readiness: async () => {},
}).listen(5102, "127.0.0.1");
