
import { createApp } from "./app.js";
import { connectDB, closeDB } from "./config/db.js";
import { env } from "./config/env.js";
import { createAuth } from "./lib/auth.js";

async function startServer() {
  try {
    await connectDB();

    const auth = createAuth();
    const app = createApp(auth);

    const server = app.listen(env.PORT, () => {
      console.log(
        `NGC Science Club API running on port ${env.PORT}`
      );
    });

    async function shutdown() {
      server.close(async () => {
        await closeDB();
        process.exit(0);
      });
    }

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Server startup failed:", error);
    await closeDB();
    process.exit(1);
  }
}

startServer();
