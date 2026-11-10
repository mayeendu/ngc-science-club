import { createApp } from "./app.js";
import { connectDB, closeDB } from "./config/db.js";
import { env } from "./config/env.js";
import { createAuth } from "./lib/auth.js";
import { createAssessmentRepository } from "./modules/assessments/assessment.repository.js";
import { startAssessmentWorker } from "./modules/assessments/assessment.worker.js";

async function startServer() {
  try {
    await connectDB();

    const auth = createAuth();
    const app = createApp(auth);
    const stopAssessments = startAssessmentWorker(createAssessmentRepository());

    const server = app.listen(env.PORT, () => {
      console.log(`NGC Science Club API running on port ${env.PORT}`);
    });

    async function shutdown() {
      server.close(async () => {
        await stopAssessments();
        await closeDB();
        process.exit(0);
      });
    }

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
