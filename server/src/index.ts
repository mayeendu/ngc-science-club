import { createApp } from "./app.js";
import { connectDB, closeDB } from "./config/db.js";
import { env } from "./config/env.js";
import { createAuth } from "./lib/auth.js";
import { createAssessmentRepository } from "./modules/assessments/assessment.repository.js";
import { startAssessmentWorker } from "./modules/assessments/assessment.worker.js";
import { createShutdown } from "./lib/shutdown.js";

async function startServer() {
  try {
    await connectDB();

    const auth = createAuth();
    const app = createApp(auth);
    const stopAssessments = startAssessmentWorker(createAssessmentRepository());

    const server = app.listen(env.PORT, "0.0.0.0", () => {
      console.log(`NGC Science Club API running on port ${env.PORT}`);
    });

    const shutdown = createShutdown(server, stopAssessments, closeDB);

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch {
    console.error(
      "Server startup failed. Check server configuration and database connectivity.",
    );
    await closeDB();
    process.exit(1);
  }
}

startServer();
