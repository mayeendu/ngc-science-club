import { Router } from "express";
import { env } from "../../config/env.js";
import type { AuthHandler } from "../../types/auth.js";
import type { ApplicationRepository } from "./application.repository.js";
import { createApplicationService } from "./application.service.js";
import { createApplicationController } from "./application.controller.js";

const trustedOrigin: AuthHandler = (req, res, next) => {
  if (req.get("origin") !== env.CLIENT_URL) {
    res
      .status(403)
      .json({ success: false, message: "Untrusted request origin" });
    return;
  }
  next();
};

export function createApplicationRouter(
  authenticate: AuthHandler,
  studentOnly: AuthHandler,
  repository: ApplicationRepository,
) {
  const router = Router();
  const controller = createApplicationController(
    createApplicationService(repository),
  );
  router.use(authenticate, studentOnly);
  router.get("/me", controller.status);
  router.get("/me/profile", controller.ownProfile);
  router.patch("/me/profile", trustedOrigin, controller.updateOwnProfile);
  router.post("/", trustedOrigin, controller.submit);
  return router;
}

export function createAdminApplicationRouter(
  authenticate: AuthHandler,
  adminOnly: AuthHandler,
  repository: ApplicationRepository,
) {
  const router = Router();
  const controller = createApplicationController(
    createApplicationService(repository),
  );
  router.use(authenticate, adminOnly);
  router.get("/", controller.list);
  router.patch("/:id/review", trustedOrigin, controller.review);
  return router;
}
