import { Router } from "express";
import type { AuthHandler } from "../../types/auth.js";
import { parseAnalyticsRange } from "../membership-analytics/analytics.schema.js";
import { reportCsv, type ReportRepository } from "./report.repository.js";
export function createReportRouter(
  authenticate: AuthHandler,
  admin: AuthHandler,
  repository: ReportRepository,
) {
  const router = Router();
  router.use(authenticate, admin);
  router.get("/", async (req, res) => {
    res.json({
      success: true,
      report: await repository.get(parseAnalyticsRange(req.query)),
    });
  });
  router.get("/export.csv", async (req, res) => {
    const report = await repository.get(parseAnalyticsRange(req.query));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="club-report-${report.range.from}-${report.range.to}.csv"`,
    );
    res.type("text/csv").send(reportCsv(report));
  });
  return router;
}
