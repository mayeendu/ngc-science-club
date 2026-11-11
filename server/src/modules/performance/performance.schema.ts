import { z } from "zod";
import { AppError } from "../../utils/app-error.js";
import { parseAnalyticsRange } from "../membership-analytics/analytics.schema.js";

const querySchema = z.strictObject({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  subject: z.string().trim().min(2).max(100).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export function parsePerformanceQuery(value: unknown) {
  const parsed = querySchema.safeParse(value);
  if (!parsed.success) throw new AppError(400, "Invalid performance filters.");
  const { from, to, subject, page } = parsed.data;
  return { ...parseAnalyticsRange({ from, to }), subject, page };
}
export type PerformanceQuery = ReturnType<typeof parsePerformanceQuery>;
export type PerformanceActor = {
  id: string;
  role: "student" | "teacher" | "admin";
};
