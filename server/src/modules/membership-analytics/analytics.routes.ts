import { Router } from "express";
import type { AuthHandler } from "../../types/auth.js";
import type { AnalyticsRepository } from "./analytics.repository.js";
import { parseAnalyticsRange } from "./analytics.schema.js";

export function createAnalyticsRouter(
  authenticate: AuthHandler,
  adminOnly: AuthHandler,
  repository: AnalyticsRepository,
) {
  const router = Router();
  const getAnalytics: AuthHandler = async (req, res) => {
    const analytics = await repository.get(parseAnalyticsRange(req.query));
    res.json({ success: true, analytics });
  };
  router.get("/", authenticate, adminOnly, getAnalytics);
  return router;
}
