import { Router } from "express";
import type { AuthHandler } from "../../types/auth.js";
import { AppError } from "../../utils/app-error.js";
import { parsePerformanceQuery } from "./performance.schema.js";
import type { PerformanceRepository } from "./performance.repository.js";

export function createPerformanceRouter(
  authenticate: AuthHandler,
  authorize: AuthHandler,
  repository: PerformanceRepository,
) {
  const router = Router();
  const report: AuthHandler = async (req, res) => {
    const { user, role } = res.locals;
    if (!user) throw new AppError(401, "Authentication required");
    if (role !== "student" && role !== "teacher" && role !== "admin")
      throw new AppError(403, "Insufficient permissions");
    res.json({
      success: true,
      ...(await repository.get(
        { id: user.id, role },
        parsePerformanceQuery(req.query),
      )),
    });
  };
  router.get("/", authenticate, authorize, report);
  return router;
}
