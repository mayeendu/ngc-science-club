import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import type { Auth } from "./lib/auth.js";

import { env } from "./config/env.js";
import { memberRouter } from "./modules/members/member.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { requireAuth } from "./middleware/require-auth.middleware.js";

export function createApp(auth: Auth) {
  const app = express();


  app.get(
    "/api/me",
    requireAuth(auth),
    (_req, res) => {
      const user = res.locals.user;

      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      });
    }
  );


  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );

  // Register Better Auth BEFORE express.json()
  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      success: true,
      message: "NGC Science Club API is running!",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/members", memberRouter);

  app.use(notFoundMiddleware);
  app.use(errorHandler);

  return app;
}
